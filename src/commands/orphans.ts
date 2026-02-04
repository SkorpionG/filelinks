import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { findGitRoot, isInGitRepo } from '../utils/git';
import { findRootConfigFile, parseRootConfig } from '../utils/rootConfig';
import { findLinkFilesRecursive } from './list';
import { CLI_NAME } from '../constants';
import {
  displayCommandHeader,
  displayWarning,
  displaySuccess,
  displayHeader,
  displayDim,
  displayBlankLine,
  displayError,
} from '../utils/ui';
import type { FileLinkConfigArray } from '../types';

/**
 * Options for the 'orphans' command
 */
export interface OrphansOptions {
  /** Show verbose output including file info */
  verbose?: boolean;
}

/**
 * Find all link files referenced by the root config
 *
 * @param gitRoot - The git repository root directory
 * @returns Set of absolute paths to referenced link files
 */
function findReferencedByRootConfig(gitRoot: string): Set<string> {
  const referenced = new Set<string>();

  const rootConfigPath = findRootConfigFile(gitRoot);
  if (!rootConfigPath) {
    return referenced;
  }

  try {
    const parsedConfig = parseRootConfig(rootConfigPath);

    if (parsedConfig.linkFiles && parsedConfig.linkFiles.length > 0) {
      for (const linkFile of parsedConfig.linkFiles) {
        if (linkFile.path) {
          const absolutePath = path.isAbsolute(linkFile.path)
            ? linkFile.path
            : path.resolve(gitRoot, linkFile.path);

          const normalizedPath = path.normalize(absolutePath);
          referenced.add(normalizedPath);
        }
      }
    }
  } catch {
    // Silently skip if root config can't be parsed
    // The orphans command will still work for extends references
  }

  return referenced;
}

/**
 * Find all link files referenced via extends fields
 *
 * @param linkFiles - Array of all link file paths to scan
 * @param gitRoot - The git repository root directory
 * @returns Set of absolute paths to referenced link files
 */
function findReferencedByExtends(linkFiles: string[], gitRoot: string): Set<string> {
  const referenced = new Set<string>();

  for (const linkFilePath of linkFiles) {
    try {
      const content = fs.readFileSync(linkFilePath, 'utf-8');
      const config: FileLinkConfigArray = JSON.parse(content);

      if (!Array.isArray(config)) {
        continue;
      }

      // Check each link in the file for extends field
      for (const link of config) {
        if (link.extends) {
          // Try resolving the extends path relative to the current link file's directory first
          const baseDir = path.dirname(linkFilePath);
          let absolutePath = path.resolve(baseDir, link.extends);
          let normalizedPath = path.normalize(absolutePath);

          // If the file doesn't exist, try resolving relative to the git root
          // This supports both relative paths (./marketing/file.json) and
          // root-relative paths (apps/web/components/marketing/file.json)
          if (!fs.existsSync(normalizedPath)) {
            absolutePath = path.resolve(gitRoot, link.extends);
            normalizedPath = path.normalize(absolutePath);
          }

          // Only add if the file exists (to avoid adding broken references)
          if (fs.existsSync(normalizedPath)) {
            referenced.add(normalizedPath);
          }
        }
      }
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  return referenced;
}

/**
 * Find orphaned link files - files that exist but aren't referenced anywhere
 *
 * A link file is considered orphaned if:
 * - It exists in the repository
 * - It's NOT referenced in filelinks.config.ts
 * - It's NOT referenced by any other link file's extends field
 *
 * This command helps identify unused or forgotten link files that can be cleaned up.
 *
 * @param options - Command options (verbose)
 * @returns Promise that resolves when the command is complete
 *
 * @example
 * // Find orphaned link files
 * await orphansCommand({});
 *
 * @example
 * // Find with verbose output
 * await orphansCommand({ verbose: true });
 */
export async function orphansCommand(options: OrphansOptions = {}): Promise<void> {
  displayCommandHeader(`Find orphaned ${CLI_NAME} link files`, '');

  // Check if we're in a git repository
  if (!isInGitRepo()) {
    displayWarning('Not in a git repository.');
    displayDim('This command works best in a git repository to find the root.\n');
    return;
  }

  const gitRoot = findGitRoot();
  if (!gitRoot) {
    displayError('Could not find git repository root');
    return;
  }

  displayHeader('Scanning for link files...\n');

  // Find all link files in the repository
  const allLinkFiles = await findLinkFilesRecursive(gitRoot);

  if (allLinkFiles.length === 0) {
    displayWarning('No link files found in repository.');
    displayDim(`Create one using: ${CLI_NAME} new\n`);
    return;
  }

  displayDim(`Found ${allLinkFiles.length} total link file(s)\n`);

  // Find all referenced link files
  displayHeader('Finding referenced link files...\n');

  const referencedByConfig = findReferencedByRootConfig(gitRoot);
  const referencedByExtends = findReferencedByExtends(allLinkFiles, gitRoot);

  // Combine all referenced files
  const allReferenced = new Set([...referencedByConfig, ...referencedByExtends]);

  displayDim(`${referencedByConfig.size} referenced by ${chalk.cyan('filelinks.config.ts')}`);
  displayDim(`${referencedByExtends.size} referenced by ${chalk.cyan('extends')} fields\n`);

  // Find orphaned files (all files minus referenced files)
  const orphanedFiles: string[] = [];

  for (const linkFile of allLinkFiles) {
    const normalizedPath = path.normalize(linkFile);
    if (!allReferenced.has(normalizedPath)) {
      orphanedFiles.push(linkFile);
    }
  }

  // Display results
  displayBlankLine();

  if (orphanedFiles.length === 0) {
    displaySuccess('No orphaned link files found! All link files are referenced.\n');
    displayDim(
      `All ${allLinkFiles.length} link file(s) are either in the root config or referenced via extends.\n`
    );
    return;
  }

  displayWarning(`Found ${chalk.yellow(orphanedFiles.length.toString())} orphaned link file(s):\n`);

  // Group orphaned files by directory for better readability
  const groupedByDir: Record<string, string[]> = {};
  for (const file of orphanedFiles) {
    const relativePath = path.relative(gitRoot, file);
    const dir = path.dirname(relativePath);

    if (!groupedByDir[dir]) {
      groupedByDir[dir] = [];
    }

    groupedByDir[dir].push(file);
  }

  // Display each orphaned file
  for (const [dir, files] of Object.entries(groupedByDir)) {
    const displayDir = dir === '.' ? '(repository root)' : dir;
    displayHeader(`${displayDir}/`);

    files.forEach((file) => {
      const fileName = path.basename(file);
      const relativePath = path.relative(gitRoot, file);

      if (options.verbose) {
        // Show additional context about why it's orphaned
        const inConfig = referencedByConfig.has(path.normalize(file));
        const inExtends = referencedByExtends.has(path.normalize(file));
        const status = [];
        if (!inConfig) status.push('not in config');
        if (!inExtends) status.push('no extends refs');
        const statusText = chalk.dim(`(${status.join(', ')})`);
        console.log(`  • ${chalk.yellow(fileName)} - ${chalk.dim(relativePath)} ${statusText}`);
      } else {
        console.log(`  • ${chalk.yellow(fileName)} - ${chalk.dim(relativePath)}`);
      }
    });

    displayBlankLine();
  }

  // Show summary and suggestions
  console.log(
    chalk.bold(`Total: ${chalk.yellow(orphanedFiles.length.toString())} orphaned file(s)\n`)
  );

  displayDim('These files exist but are not referenced by:');
  displayDim(`  • ${CLI_NAME}.config.ts (root configuration)`);
  displayDim(`  • Any other link file's "extends" field\n`);

  displayDim('Suggestions:');
  displayDim(`  • Add them to root config: ${CLI_NAME} init (or edit filelinks.config.ts)`);
  displayDim(`  • Reference them via "extends" in another link file`);
  displayDim(`  • Delete them if they're no longer needed\n`);

  if (!options.verbose) {
    displayDim(`Run "${CLI_NAME} orphans --verbose" for more details\n`);
  }
}
