import chalk from 'chalk';
import { configManager } from '../config';
import { FileLinkConfigArray, FileLinkConfig } from '../types';
import {
  getChangedFiles,
  findMatchingFiles,
  getLastCommitInfo,
  isGlobPattern,
  findFilesMatchingPattern,
} from '../utils/changes';
import { requireGitRepository } from '../utils/commandHelpers';
import { CLI_NAME } from '../constants';
import { validateLinkFilePath } from '../utils/linkFileValidation';
import { loadLinkFiles } from '../utils/linkFileLoader';
import {
  displayCommandHeader,
  displayWarning,
  displayDim,
  displayProcessing,
  displayHeader,
  displaySuccess,
  displayFilePath,
  displayError,
  displayStatus,
  displayBlankLine,
} from '../utils/ui';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Options for the 'check' command
 */
export interface CheckOptions {
  /** Check only specific link file by ID (from root config) */
  id?: string;
  /** Verbose output with additional details */
  verbose?: boolean;
  /** Path to a specific link file to check */
  file?: string;
}

/**
 * Result of checking a single link
 */
interface LinkCheckResult {
  link: FileLinkConfig;
  changedWatchFiles: string[];
  hasChanges: boolean;
}

/**
 * Check for changes in watched files and notify about targets
 *
 * This command detects changes in watched files based on their watchType
 * (uncommitted, unstaged, or staged) and notifies users which target
 * files may need to be updated.
 *
 * Behavior:
 * - Requires being in a git repository
 * - Loads link files (either from root config or current directory)
 * - Detects changes based on each link's watchType
 * - Prints warnings for targets that may need updates
 * - With file argument: only checks the specified link file path
 * - With --id flag: only checks the specified link file by ID
 * - With --verbose flag: shows additional commit information
 *
 * @param options - Command options (id, verbose, file)
 * @returns Promise that resolves when check is complete
 *
 * @example
 * // Check all links
 * await checkCommand({});
 *
 * @example
 * // Check only API links by ID
 * await checkCommand({ id: 'api-docs' });
 *
 * @example
 * // Check a specific file
 * await checkCommand({ file: './path/to/filelinks.links.json' });
 *
 * @example
 * // Verbose output
 * await checkCommand({ verbose: true });
 */
export async function checkCommand(options: CheckOptions = {}): Promise<void> {
  displayCommandHeader('check', CLI_NAME);

  // Verify we're in a git repository
  const gitRoot = requireGitRepository(false, CLI_NAME);

  // If a specific file is provided, check only that file
  if (options.file) {
    await checkSpecificFile(options.file, gitRoot, options.verbose);
    return;
  }

  // Load link configurations
  const linkFiles = await loadLinkFiles(gitRoot, { id: options.id, showWarnings: true });

  if (linkFiles.length === 0) {
    displayWarning('No link files found to check.');
    displayDim(`  Run "${CLI_NAME} new" to create a link file.\n`);
    return;
  }

  displayProcessing(`Checking ${linkFiles.length} link file(s)`);

  // Check each link file
  let totalLinksChecked = 0;
  let totalIssuesFound = 0;

  for (const { id, name, links, path: linkFilePath } of linkFiles) {
    if (linkFiles.length > 1) {
      displayBlankLine();
      displayHeader(name || id);
      displayDim(`  ${linkFilePath}`);
    }

    const results = await checkLinks(links, gitRoot, linkFilePath, options.verbose);
    totalLinksChecked += results.length;

    const issuesFound = results.filter((r) => r.hasChanges).length;
    totalIssuesFound += issuesFound;

    if (issuesFound === 0 && options.verbose) {
      displaySuccess('No changes detected');
    }
  }

  // Summary
  displayBlankLine();
  displayHeader('Summary:');
  displayDim(`  Checked ${totalLinksChecked} link(s)`);

  if (totalIssuesFound === 0) {
    displaySuccess(`No target files need attention\n`);
  } else {
    displayWarning(`${totalIssuesFound} link(s) have changes - review targets above\n`);
  }
}

/**
 * Check a specific link file
 *
 * @param filePath - Path to the link file to check
 * @param gitRoot - Git repository root path
 * @param verbose - Whether to show verbose output
 */
async function checkSpecificFile(
  filePath: string,
  gitRoot: string,
  verbose?: boolean
): Promise<void> {
  const absolutePath = path.resolve(filePath);

  displayFilePath('Link File', absolutePath);

  // Validate the file path (exists, is file, correct name, within repo)
  const pathValidation = validateLinkFilePath(filePath, gitRoot);
  if (!pathValidation.valid) {
    displayError(`${pathValidation.error}\n`);
    if (pathValidation.errorDetails) {
      pathValidation.errorDetails.forEach((detail) => {
        displayDim(`  ${detail}`);
      });
    }
    displayBlankLine();
    process.exit(1);
  }

  try {
    const links = configManager.loadConfig(absolutePath);
    const relativePath = path.relative(gitRoot, absolutePath);

    displayProcessing(`Checking ${links.length} link(s)`);

    const results = await checkLinks(links, gitRoot, relativePath, verbose);
    const issuesFound = results.filter((r) => r.hasChanges).length;

    if (issuesFound === 0) {
      displaySuccess('No changes detected\n');
    }

    // Summary
    displayHeader('Summary:');
    displayDim(`  Checked ${results.length} link(s)`);

    if (issuesFound === 0) {
      displaySuccess(`No target files need attention\n`);
    } else {
      displayWarning(`${issuesFound} link(s) have changes - review targets above\n`);
    }
  } catch (error) {
    displayError('Check failed');
    console.error(chalk.red('  Error:'), error instanceof Error ? error.message : error);
    displayBlankLine();
    process.exit(1);
  }
}

/**
 * Deduplicate links based on watch, target, and watchType
 *
 * If two links have the same watch array, target array, and watchType,
 * only the first one is kept.
 *
 * @param links - Array of link configurations
 * @returns Deduplicated array of links
 */
function deduplicateLinks(links: FileLinkConfigArray): FileLinkConfigArray {
  const seen = new Set<string>();
  const deduplicated: FileLinkConfigArray = [];

  for (const link of links) {
    // Create a unique key based on watch, target, and watchType
    // Skip links without watch or target (should have been filtered by validation)
    if (!link.watch || !link.target) {
      continue;
    }
    const watchType = link.watchType || 'uncommitted';
    const watchKey = [...link.watch].sort().join('|');
    const targetKey = [...link.target].sort().join('|');
    const key = `${watchType}::${watchKey}::${targetKey}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(link);
    }
  }

  return deduplicated;
}

/**
 * Print a message for a link with no changes (verbose mode only)
 *
 * @param link - Link configuration
 * @param linkFilePath - Relative path to the link file from git root
 */
function printLinkNoChanges(link: FileLinkConfig, linkFilePath: string): void {
  const linkName = link.name || link.id || 'Unnamed link';

  displayBlankLine();
  displaySuccess(linkName);
  displayDim(`  ${linkFilePath}`);

  if (link.description) {
    displayDim(`  ${link.description}`);
  }

  displayDim(`  ✓ No changes detected`);
  displayBlankLine();
}

/**
 * Check an array of links for changes
 *
 * @param links - Array of link configurations to check
 * @param gitRoot - Git repository root path
 * @param linkFilePath - Relative path to the link file from git root
 * @param verbose - Whether to show verbose output
 * @returns Array of check results
 */
async function checkLinks(
  links: FileLinkConfigArray,
  gitRoot: string,
  linkFilePath: string,
  verbose?: boolean
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];

  // Deduplicate links before checking
  const deduplicatedLinks = deduplicateLinks(links);

  for (const link of deduplicatedLinks) {
    const result = await checkSingleLink(link, gitRoot, verbose);
    results.push(result);

    if (result.hasChanges) {
      await printLinkWarning(link, result.changedWatchFiles, gitRoot, linkFilePath, verbose);
    } else if (verbose) {
      printLinkNoChanges(link, linkFilePath);
    }
  }

  return results;
}

/**
 * Check a single link for changes
 *
 * @param link - Link configuration to check
 * @param gitRoot - Git repository root path
 * @param verbose - Whether to show verbose output
 * @returns Check result
 */
async function checkSingleLink(
  link: FileLinkConfig,
  gitRoot: string,
  verbose?: boolean
): Promise<LinkCheckResult> {
  const watchType = link.watchType || 'uncommitted';

  try {
    // Skip links without watch property (should have been filtered by validation)
    if (!link.watch) {
      return { link, hasChanges: false, changedWatchFiles: [] };
    }

    // Get changed files from git
    const changedFiles = await getChangedFiles(watchType, gitRoot);

    // Find which watch files have changes
    const changedWatchFiles = findMatchingFiles(changedFiles, link.watch);

    return {
      link,
      changedWatchFiles,
      hasChanges: changedWatchFiles.length > 0,
    };
  } catch (error) {
    if (verbose) {
      console.log(
        chalk.red(`  Error checking link: ${error instanceof Error ? error.message : error}`)
      );
    }
    return {
      link,
      changedWatchFiles: [],
      hasChanges: false,
    };
  }
}

/**
 * Print a warning for a link with changes
 *
 * @param link - Link configuration
 * @param changedFiles - Files that have changed
 * @param gitRoot - Git repository root path
 * @param linkFilePath - Relative path to the link file from git root
 * @param verbose - Whether to show verbose output
 */
async function printLinkWarning(
  link: FileLinkConfig,
  changedFiles: string[],
  gitRoot: string,
  linkFilePath: string,
  verbose?: boolean
): Promise<void> {
  const linkName = link.name || link.id || 'Unnamed link';
  const watchType = link.watchType || 'uncommitted';

  displayBlankLine();
  displayWarning(linkName);
  displayDim(`  ${linkFilePath}`);

  if (link.description) {
    displayDim(`  ${link.description}`);
  }

  displayBlankLine();
  displayHeader(`  Changed files (${watchType}):`);
  for (const file of changedFiles) {
    console.log(chalk.cyan(`    • ${file}`));

    if (verbose) {
      const commitInfo = await getLastCommitInfo(file, gitRoot);
      if (commitInfo) {
        displayDim(
          `      Last commit: ${commitInfo.hash} - ${commitInfo.message} (${commitInfo.author})`
        );
      }
    }
  }

  displayBlankLine();
  displayHeader(`  Please review these target files:`);
  for (const target of link.target || []) {
    // Check if target is a glob pattern
    if (isGlobPattern(target)) {
      // Find all files matching the pattern
      const matchedFiles = await findFilesMatchingPattern(target, gitRoot);

      if (matchedFiles.length === 0) {
        // No files match the pattern - show warning
        displayStatus(target, false);
        displayDim(`      (pattern matches 0 files)`);
      } else {
        // Show the pattern and all matched files
        console.log(chalk.dim(`    ${target}:`));
        for (const matchedFile of matchedFiles) {
          const matchedPath = path.join(gitRoot, matchedFile);
          const exists = fs.existsSync(matchedPath);
          console.log(
            chalk.dim(`      • ${matchedFile}`) + (exists ? chalk.green(' ✓') : chalk.red(' ✗'))
          );
        }
      }
    } else {
      // Regular file path
      const targetPath = path.join(gitRoot, target);
      const exists = fs.existsSync(targetPath);
      displayStatus(target, exists);
    }
  }

  displayBlankLine();
}
