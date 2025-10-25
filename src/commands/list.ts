import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { findGitRoot, isInGitRepo } from '../utils/git';
import { findRootConfigFile, parseRootConfig } from '../utils/rootConfig';
import { LINK_FILE_NAMES, IGNORE_PATTERNS, CLI_NAME, ROOT_CONFIG_FILE_NAME } from '../constants';
import { getFormattedFileSize } from '../utils/fileSize';
import type { FileLinkConfigArray } from '../types';
import {
  displayCommandHeader,
  displayWarning,
  displaySuccess,
  displayHeader,
  displayDim,
  displayList,
  displayBlankLine,
  displayError,
} from '../utils/ui';

/**
 * Options for the 'list' command
 */
export interface ListOptions {
  /** List only link files in the current directory (non-recursive) */
  local?: boolean;
  /** List link files from root config only */
  config?: boolean;
  /** Show verbose output including file sizes */
  verbose?: boolean;
}

/**
 * Count the number of links in a link file
 *
 * @param filePath - Absolute path to the link file
 * @returns Number of links in the file, or 0 if file is invalid/empty
 */
export function countLinksInFile(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config: FileLinkConfigArray = JSON.parse(content);

    if (!Array.isArray(config)) {
      return 0;
    }

    return config.length;
  } catch {
    return 0;
  }
}

/**
 * Find link files in a specific directory (non-recursive)
 *
 * @param directory - The directory to search in
 * @returns Array of absolute file paths
 */
export function findLinkFilesInDirectory(directory: string): string[] {
  const linkFiles: string[] = [];

  // Search for each possible link file name
  for (const fileName of LINK_FILE_NAMES) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) {
      linkFiles.push(filePath);
    }
  }

  return linkFiles;
}

/**
 * Find link files recursively from a directory
 *
 * @param rootDir - The root directory to search from
 * @returns Promise that resolves to an array of absolute file paths
 */
export async function findLinkFilesRecursive(rootDir: string): Promise<string[]> {
  const patterns = LINK_FILE_NAMES.map((name) => `**/${name}`);
  const linkFiles: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: rootDir,
      absolute: true,
      ignore: IGNORE_PATTERNS as unknown as string[],
    });

    linkFiles.push(...matches);
  }

  // Remove duplicates and sort
  const uniqueFiles = Array.from(new Set(linkFiles));
  return uniqueFiles.sort();
}

/**
 * Group link files by their directory
 *
 * @param files - Array of absolute file paths
 * @param rootDir - The root directory to calculate relative paths from
 * @returns Object mapping directory paths to arrays of file paths
 */
export function groupLinkFilesByDirectory(
  files: string[],
  rootDir: string
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const file of files) {
    const relativePath = path.relative(rootDir, file);
    const dir = path.dirname(relativePath);

    if (!grouped[dir]) {
      grouped[dir] = [];
    }

    grouped[dir].push(file);
  }

  return grouped;
}

/**
 * List all filelinks.links.json files
 *
 * This command can operate in several modes:
 * 1. Default: Lists link files recursively from current directory
 * 2. --local: Lists only link files in the current directory (non-recursive)
 * 3. --config: Lists link files defined in filelinks.config.ts
 * 4. --config --local: Lists config files that are in current directory and subdirectories
 * 5. --verbose: Shows file sizes and link counts in addition to file information
 *
 * Behavior:
 * - Default mode searches recursively from current directory
 * - --local restricts search to current directory only (non-recursive)
 * - --config shows files from root configuration
 * - --config --local filters config files to current directory and below
 * - Can be run from anywhere within a git repository
 * - Shows file sizes and link counts when --verbose flag is used
 *
 * @param options - Command options (local, config, verbose)
 * @returns Promise that resolves when listing is complete
 *
 * @example
 * // List link files recursively from current directory
 * await listCommand({});
 *
 * @example
 * // List only in current directory (non-recursive)
 * await listCommand({ local: true });
 *
 * @example
 * // List from root config
 * await listCommand({ config: true });
 *
 * @example
 * // List config files in current directory and subdirectories
 * await listCommand({ config: true, local: true });
 *
 * @example
 * // List with verbose output (shows file sizes and link counts)
 * await listCommand({ verbose: true });
 */
export async function listCommand(options: ListOptions = {}): Promise<void> {
  displayCommandHeader(`List ${CLI_NAME} link files`, '');

  // Handle --config flag: list from root config
  if (options.config) {
    await listFromRootConfig(options.verbose, options.local);
    return;
  }

  // Handle --local flag: list only in current directory (non-recursive)
  if (options.local) {
    await listLocalLinkFiles(options.verbose);
    return;
  }

  // Default: list link files recursively from current directory
  await listLinkFilesFromCurrentDir(options.verbose);
}

/**
 * List link files recursively from the current directory
 * This is the default behavior when no flags are specified
 *
 * @param verbose - Show file sizes if true
 */
async function listLinkFilesFromCurrentDir(verbose?: boolean): Promise<void> {
  const currentDir = process.cwd();
  displayHeader('Link files in current directory and subdirectories:\n');

  const linkFiles = await findLinkFilesRecursive(currentDir);

  if (linkFiles.length === 0) {
    displayWarning('No link files found in current directory or subdirectories.');
    displayDim(`Create one using: ${CLI_NAME} new\n`);
    return;
  }

  displaySuccess(`Found ${chalk.cyan(linkFiles.length.toString())} link file(s):\n`);

  // Group by directory for better readability
  const groupedByDir = groupLinkFilesByDirectory(linkFiles, currentDir);

  for (const [dir, files] of Object.entries(groupedByDir)) {
    const displayDir = dir === '.' ? '(current directory)' : dir;
    displayHeader(`${displayDir}/`);

    // Display each file with colored filename and dimmed path
    files.forEach((file) => {
      const fileName = path.basename(file);
      const relativePath = path.relative(currentDir, file);

      if (verbose) {
        const size = getFormattedFileSize(file);
        const linkCount = countLinksInFile(file);
        const linkText = linkCount === 1 ? 'link' : 'links';
        const verboseInfo = ` ${chalk.dim(`(${size}, ${linkCount} ${linkText})`)}`;
        console.log(`  • ${chalk.green(fileName)} - ${chalk.dim(relativePath)}${verboseInfo}`);
      } else {
        console.log(`  • ${chalk.green(fileName)} - ${chalk.dim(relativePath)}`);
      }
    });

    displayBlankLine();
  }

  // Show additional information with colors
  console.log(chalk.bold(`Total: ${chalk.cyan(linkFiles.length.toString())} link file(s)\n`));
  displayDim(
    `Run "${CLI_NAME} list --local" to see only files in current directory (non-recursive)`
  );
  displayDim(`Run "${CLI_NAME} list --config" to see files from ${ROOT_CONFIG_FILE_NAME}`);
  if (!verbose) {
    displayDim(`Run "${CLI_NAME} list --verbose" to see file sizes and link counts`);
  }
  console.log();
}

/**
 * List link files only in the current directory
 *
 * @param verbose - Show file sizes if true
 */
async function listLocalLinkFiles(verbose?: boolean): Promise<void> {
  const currentDir = process.cwd();
  displayHeader('Link files in current directory:\n');

  const linkFiles = findLinkFilesInDirectory(currentDir);

  if (linkFiles.length === 0) {
    displayWarning('No link files found in current directory.');
    displayDim(`Create one using: ${CLI_NAME} new\n`);
    return;
  }

  displaySuccess(`Found ${linkFiles.length} link file(s):\n`);

  if (verbose) {
    // Show file sizes and link counts in verbose mode
    const items = linkFiles.map((file: string) => {
      const fileName = path.basename(file);
      const size = getFormattedFileSize(file);
      const linkCount = countLinksInFile(file);
      const linkText = linkCount === 1 ? 'link' : 'links';
      return `${fileName} (${size}, ${linkCount} ${linkText})`;
    });
    displayList(items);
  } else {
    // Just show filenames without sizes
    const items = linkFiles.map((file: string) => path.basename(file));
    displayList(items);
  }

  displayBlankLine();

  if (!verbose) {
    displayDim(`Run "${CLI_NAME} list --local --verbose" to see file sizes and link counts\n`);
  }
}

/**
 * List link files from the root configuration file
 *
 * @param verbose - Show file sizes if true
 * @param local - Filter to only show files in current directory and subdirectories
 */
async function listFromRootConfig(verbose?: boolean, local?: boolean): Promise<void> {
  // Check if we're in a git repository
  if (!isInGitRepo()) {
    displayWarning('Not in a git repository.');
    displayDim('Root configuration requires a git repository.\n');
    return;
  }

  const gitRoot = findGitRoot();
  if (!gitRoot) {
    displayError('Could not find git repository root');
    return;
  }

  // Find the root config file
  const rootConfigPath = findRootConfigFile(gitRoot);
  if (!rootConfigPath) {
    displayWarning('No root configuration found.');
    displayDim(`Run "${CLI_NAME} init" at the git root to create one.\n`);
    return;
  }

  displayHeader(`Link files from ${ROOT_CONFIG_FILE_NAME}:\n`);
  displayDim(`Config: ${path.relative(process.cwd(), rootConfigPath)}\n`);

  // Parse the root config
  let parsedConfig;
  try {
    parsedConfig = parseRootConfig(rootConfigPath);
  } catch (error) {
    displayError(
      `Failed to parse root configuration: ${error instanceof Error ? error.message : error}`
    );
    return;
  }

  if (!parsedConfig.linkFiles || parsedConfig.linkFiles.length === 0) {
    displayWarning('No link files defined in root configuration.');
    displayDim(`Add link files by running "${CLI_NAME} new" in subdirectories.\n`);
    return;
  }

  // Filter files if --local flag is set
  let linkFilesToDisplay = parsedConfig.linkFiles;
  if (local) {
    const currentDir = process.cwd();
    linkFilesToDisplay = parsedConfig.linkFiles.filter((linkFile) => {
      if (!linkFile.path) return false;
      const absolutePath = path.isAbsolute(linkFile.path)
        ? linkFile.path
        : path.resolve(gitRoot, linkFile.path);

      // Check if the file is in current directory or subdirectories
      const relativeToCurrent = path.relative(currentDir, absolutePath);
      // If the relative path starts with "..", it's outside current directory
      return !relativeToCurrent.startsWith('..');
    });

    if (linkFilesToDisplay.length === 0) {
      displayWarning('No link files from config found in current directory or subdirectories.');
      displayDim(`Run "${CLI_NAME} list --config" to see all config files.\n`);
      return;
    }
  }

  const totalInConfig = parsedConfig.linkFiles.length;
  const displayCount = linkFilesToDisplay.length;

  if (local) {
    displaySuccess(
      `Found ${chalk.cyan(displayCount.toString())} link file(s) in current directory (out of ${totalInConfig} in config):\n`
    );
  } else {
    displaySuccess(`Found ${chalk.cyan(displayCount.toString())} link file(s) in config:\n`);
  }

  // Display each link file with its status (using custom formatting for colors)
  linkFilesToDisplay.forEach((linkFile) => {
    const id = linkFile.id || '(no id)';
    const name = linkFile.name || '(no name)';
    const filePath = linkFile.path || '(no path)';

    // Check if the file actually exists
    let exists = true;
    if (linkFile.path) {
      const absolutePath = path.isAbsolute(linkFile.path)
        ? linkFile.path
        : path.resolve(gitRoot, linkFile.path);

      exists = fs.existsSync(absolutePath);
    } else {
      exists = false;
    }

    // Format with colors: cyan for ID, default for name, dim for path
    const idColored = chalk.cyan(id);
    const nameColored = name;
    const pathColored = chalk.dim(filePath);
    const missingTag = exists ? '' : ' ' + chalk.yellow('[MISSING]');

    // Add size and link count info in verbose mode (only for existing files)
    let verboseInfo = '';
    if (verbose && exists && linkFile.path) {
      const absolutePath = path.isAbsolute(linkFile.path)
        ? linkFile.path
        : path.resolve(gitRoot, linkFile.path);
      const size = getFormattedFileSize(absolutePath);
      const linkCount = countLinksInFile(absolutePath);
      const linkText = linkCount === 1 ? 'link' : 'links';
      verboseInfo = ` ${chalk.dim(`[${size}, ${linkCount} ${linkText}]`)}`;
    }

    console.log(`  • ${idColored} - ${nameColored} (${pathColored})${verboseInfo}${missingTag}`);
  });

  displayBlankLine();

  // Warn about missing files (only from displayed files)
  const missingFiles = linkFilesToDisplay.filter((linkFile) => {
    if (!linkFile.path) return true;
    const absolutePath = path.isAbsolute(linkFile.path)
      ? linkFile.path
      : path.resolve(gitRoot, linkFile.path);
    return !fs.existsSync(absolutePath);
  });

  if (missingFiles.length > 0) {
    displayWarning(`${missingFiles.length} file(s) marked as [MISSING]`);
    displayDim(`Run "${CLI_NAME} validate" to check configuration integrity.`);
  }

  if (!verbose) {
    const localFlag = local ? ' --local' : '';
    displayDim(
      `Run "${CLI_NAME} list --config${localFlag} --verbose" to see file sizes and link counts`
    );
  }
  console.log();
}
