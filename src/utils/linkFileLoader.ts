import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ConfigManager } from '../config';
import { parseRootConfig } from './rootConfig';
import { validateRootConfig, validateLinksConfig } from './validation';
import { isWithinRepository } from './security';
import { ROOT_CONFIG_FILE_NAME, CLI_NAME } from '../constants';
import { ERROR_MESSAGES, WARNING_MESSAGES } from '../constants/messages';
import {
  displayRootConfigValidationErrors,
  displayIdNotFound,
  displayLinkFileValidationErrors,
  displayLinkFileValidationWarnings,
  displayError,
  displayDim,
  displayWarning,
} from './ui';
import type { FileLinkConfigArray, PartialLinkFileReference } from '../types';

/**
 * Represents a loaded link file with its metadata
 */
export interface LoadedLinkFile {
  id: string;
  name: string;
  links: FileLinkConfigArray;
  path: string;
}

/**
 * Options for loading link files
 */
export interface LinkFileLoaderOptions {
  /**
   * Optional ID to filter to a specific link file
   */
  id?: string;

  /**
   * Whether to show validation warnings (default: false)
   */
  showWarnings?: boolean;

  /**
   * Whether to filter out invalid links (default: true)
   * If false, all links are returned even if they have validation errors
   */
  filterInvalidLinks?: boolean;

  /**
   * Whether to exit on missing ID (default: true)
   * If false, returns empty array instead of exiting
   */
  exitOnMissingId?: boolean;
}

/**
 * Result of processing a single link file
 */
export interface LinkFileProcessResult {
  linkFileRef: PartialLinkFileReference;
  linkFilePath: string;
  absolutePath: string;
  links?: FileLinkConfigArray;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Load and process link files from the root configuration or current directory
 *
 * This function handles:
 * - Loading root configuration
 * - Filtering by ID if specified
 * - Security checks (repository boundaries)
 * - Duplicate detection
 * - Link file validation
 * - Error handling and reporting
 *
 * @param gitRoot - Git repository root path
 * @param options - Loading options
 * @returns Array of loaded link files
 */
export async function loadLinkFiles(
  gitRoot: string,
  options: LinkFileLoaderOptions = {}
): Promise<LoadedLinkFile[]> {
  const { id, showWarnings = false, filterInvalidLinks = true, exitOnMissingId = true } = options;

  const configManager = new ConfigManager();
  const rootConfigPath = path.join(gitRoot, ROOT_CONFIG_FILE_NAME);

  // If root config exists, use it
  if (fs.existsSync(rootConfigPath)) {
    try {
      // Parse the TypeScript config file
      const rootConfig = parseRootConfig(rootConfigPath);

      // Validate root config (skip invalid items with warnings)
      const rootValidation = validateRootConfig(rootConfig, gitRoot);
      if (rootValidation.errors.length > 0) {
        displayRootConfigValidationErrors(rootValidation.errors);
      }

      // If --id specified, filter to that link file
      const linkFilesToLoad = id
        ? rootConfig.linkFiles.filter((lf: PartialLinkFileReference) => lf.id === id)
        : rootConfig.linkFiles;

      if (id && linkFilesToLoad.length === 0) {
        if (exitOnMissingId) {
          displayIdNotFound(id, rootConfig.linkFiles as Array<{ id: string; name: string }>);
          process.exit(1);
        }
        return [];
      }

      // Process each link file
      const result: LoadedLinkFile[] = [];
      const processedFiles = new Set<string>(); // Track processed files by absolute path

      for (const linkFileRef of linkFilesToLoad) {
        const processResult = await processLinkFile(
          linkFileRef,
          gitRoot,
          configManager,
          processedFiles,
          { showWarnings, filterInvalidLinks }
        );

        if (
          processResult.links &&
          processResult.links.length > 0 &&
          linkFileRef.id &&
          linkFileRef.name &&
          linkFileRef.path
        ) {
          result.push({
            id: linkFileRef.id,
            name: linkFileRef.name,
            links: processResult.links,
            path: linkFileRef.path,
          });
        }
      }

      return result;
    } catch (error) {
      displayError(`${ERROR_MESSAGES.ROOT_CONFIG_ERROR}: ${error}`);
      process.exit(1);
    }
  }

  // No root config - try to find link file starting from gitRoot
  if (id) {
    displayError(ERROR_MESSAGES.CANNOT_USE_ID_WITHOUT_ROOT);
    displayDim(`  Run "${CLI_NAME} init" at repository root to create one.\n`);
    process.exit(1);
  }

  const localConfigPath = configManager.findConfigFile(gitRoot);
  if (!localConfigPath) {
    return [];
  }

  try {
    const links = configManager.loadConfig(localConfigPath);
    const relativePath = path.relative(gitRoot, localConfigPath);
    return [
      {
        id: 'local',
        name: path.basename(localConfigPath),
        links,
        path: relativePath,
      },
    ];
  } catch (error) {
    displayError(`${ERROR_MESSAGES.LINK_FILE_LOAD_ERROR}: ${error}`);
    return [];
  }
}

/**
 * Process a single link file reference
 *
 * @param linkFileRef - Link file reference from root config
 * @param gitRoot - Git repository root path
 * @param configManager - Config manager instance
 * @param processedFiles - Set of already processed file paths
 * @param options - Processing options
 * @returns Processing result with loaded links or error information
 */
async function processLinkFile(
  linkFileRef: PartialLinkFileReference,
  gitRoot: string,
  configManager: ConfigManager,
  processedFiles: Set<string>,
  options: { showWarnings: boolean; filterInvalidLinks: boolean }
): Promise<LinkFileProcessResult> {
  // Skip entries without required fields (validation will catch this)
  if (
    !linkFileRef.id ||
    !linkFileRef.name ||
    !linkFileRef.path ||
    typeof linkFileRef.path !== 'string' ||
    linkFileRef.path.trim() === ''
  ) {
    return {
      linkFileRef,
      linkFilePath: '',
      absolutePath: '',
      skipped: true,
      skipReason: 'Missing required fields',
    };
  }

  const linkFilePath = path.join(gitRoot, linkFileRef.path);
  const absolutePath = path.resolve(linkFilePath);

  // Security check: Ensure the resolved path is within the git repository
  const securityCheck = isWithinRepository(absolutePath, gitRoot);
  if (!securityCheck.isValid) {
    displayError(
      `${ERROR_MESSAGES.SECURITY_REFUSING_READ}: ${linkFileRef.path} (${linkFileRef.id})`
    );
    if (securityCheck.errorDetails) {
      securityCheck.errorDetails.forEach((detail) => {
        displayDim(`  ${detail}`);
      });
    }
    return {
      linkFileRef,
      linkFilePath,
      absolutePath,
      skipped: true,
      skipReason: 'Security check failed',
    };
  }

  // Skip if we've already processed this file
  if (processedFiles.has(absolutePath)) {
    displayWarning(
      `${WARNING_MESSAGES.DUPLICATE_PATH_WARNING}: ${linkFileRef.path} (${linkFileRef.id})`
    );
    return {
      linkFileRef,
      linkFilePath,
      absolutePath,
      skipped: true,
      skipReason: 'Duplicate path',
    };
  }

  if (!fs.existsSync(linkFilePath)) {
    displayWarning(
      `${WARNING_MESSAGES.LINK_FILE_NOT_FOUND_WARNING}: ${linkFileRef.path} (${linkFileRef.id})`
    );
    return {
      linkFileRef,
      linkFilePath,
      absolutePath,
      error: 'File not found',
    };
  }

  processedFiles.add(absolutePath);

  try {
    const links = configManager.loadConfig(linkFilePath);

    // Validate the links config (paths are relative to git root, not link file dir)
    const linksValidation = validateLinksConfig(links, gitRoot);

    if (linksValidation.errors.length > 0) {
      displayLinkFileValidationErrors(linkFileRef.name, linksValidation.errors);
    }

    if (options.showWarnings && linksValidation.warnings.length > 0) {
      displayLinkFileValidationWarnings(linkFileRef.name, linksValidation.warnings);
    }

    // Filter out invalid links if requested
    let validLinks = links;
    if (options.filterInvalidLinks) {
      validLinks = links.filter((link) => {
        // Check if this specific link has errors
        const singleLinkValidation = validateLinksConfig([link], gitRoot);
        return singleLinkValidation.valid;
      });
    }

    return {
      linkFileRef,
      linkFilePath,
      absolutePath,
      links: validLinks,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if it's a directory error
    if (errorMsg.includes('EISDIR')) {
      displayWarning(
        `${ERROR_MESSAGES.PATH_IS_DIRECTORY}: ${linkFileRef.path} (${linkFileRef.id})`
      );
    } else {
      displayWarning(`Error loading ${linkFileRef.path}: ${errorMsg} (${linkFileRef.id})`);
    }

    return {
      linkFileRef,
      linkFilePath,
      absolutePath,
      error: errorMsg,
    };
  }
}

/**
 * Process link files for validation (doesn't return loaded files, just validates them)
 *
 * This is specifically for the validate command which doesn't need to load
 * the files into memory, just check them and report errors.
 *
 * @param rootConfig - Parsed root configuration
 * @param gitRoot - Git repository root path
 * @returns Object with hasErrors flag and processed file count
 */
export async function validateLinkFiles(
  rootConfig: ReturnType<typeof parseRootConfig>,
  gitRoot: string
): Promise<{ hasErrors: boolean; processedCount: number }> {
  const configManager = new ConfigManager();
  const processedFiles = new Set<string>();
  let hasErrors = false;

  for (const linkFileRef of rootConfig.linkFiles) {
    // Skip entries without required fields
    if (
      !linkFileRef.id ||
      !linkFileRef.name ||
      !linkFileRef.path ||
      typeof linkFileRef.path !== 'string' ||
      linkFileRef.path.trim() === ''
    ) {
      continue;
    }

    const linkFilePath = path.join(gitRoot, linkFileRef.path);
    const absolutePath = path.resolve(linkFilePath);

    // Security check: Ensure the path is within the repository
    const securityCheck = isWithinRepository(absolutePath, gitRoot);
    if (!securityCheck.isValid) {
      console.log(chalk.bold(`${linkFileRef.name} (${linkFileRef.id}):`));
      console.log(chalk.dim(`  ${linkFileRef.path}\n`));
      hasErrors = true;
      console.log(chalk.red(`  ✗ Security: Path points outside repository`));
      if (securityCheck.errorDetails) {
        securityCheck.errorDetails.forEach((detail) => {
          console.log(chalk.dim(`    ${detail}`));
        });
      }
      console.log();
      continue;
    }

    // Skip if we've already processed this file
    if (processedFiles.has(absolutePath)) {
      console.log(chalk.bold(`${linkFileRef.name} (${linkFileRef.id}):`));
      console.log(chalk.dim(`  ${linkFileRef.path}\n`));
      console.log(chalk.yellow(`  ⚠ Skipping: Duplicate path (already validated above)\n`));
      continue;
    }

    console.log(chalk.bold(`${linkFileRef.name} (${linkFileRef.id}):`));
    console.log(chalk.dim(`  ${linkFileRef.path}\n`));

    if (!fs.existsSync(linkFilePath)) {
      hasErrors = true;
      console.log(chalk.red(`  ✗ File not found\n`));
      continue;
    }

    processedFiles.add(absolutePath);

    try {
      const links = configManager.loadConfig(linkFilePath);
      // Paths are relative to git root, not link file directory
      const linksValidation = validateLinksConfig(links, gitRoot);

      if (linksValidation.errors.length > 0) {
        hasErrors = true;
        console.log(chalk.red('  ✗ Link file has errors:\n'));
        printIssues(linksValidation.errors, '    ');
      } else {
        console.log(chalk.green(`  ✓ Valid (${links.length} link(s))`));
      }

      if (linksValidation.warnings.length > 0) {
        console.log(chalk.yellow('\n  ⚠ Warnings:\n'));
        printIssues(linksValidation.warnings, '    ');
      }

      console.log();
    } catch (error) {
      hasErrors = true;
      console.log(
        chalk.red(`  ✗ Error loading file: ${error instanceof Error ? error.message : error}\n`)
      );
    }
  }

  return { hasErrors, processedCount: processedFiles.size };
}

/**
 * Helper to print validation issues with optional indentation
 */
function printIssues(
  issues: Array<{ message: string; context?: string }>,
  indent: string = ''
): void {
  issues.forEach((issue) => {
    const contextStr = issue.context ? ` (${issue.context})` : '';
    console.log(`${indent}• ${issue.message}${contextStr}`);
  });
}
