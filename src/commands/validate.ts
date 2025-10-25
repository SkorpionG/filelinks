import chalk from 'chalk';
import { configManager } from '../config';
import { validateRootConfig, validateLinksConfig, ValidationIssue } from '../utils/validation';
import { findGitRoot } from '../utils/git';
import { requireGitRepository } from '../utils/commandHelpers';
import { CLI_NAME, ROOT_CONFIG_FILE_NAME } from '../constants';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants/messages';
import { validateLinkFilePath } from '../utils/linkFileValidation';
import { parseRootConfig } from '../utils/rootConfig';
import { validateLinkFiles } from '../utils/linkFileLoader';
import {
  displayCommandHeader,
  displayHeader,
  displayFilePath,
  displaySuccess,
  displayError,
  displayDim,
  displayWarning,
  displayIssues,
  displayBlankLine,
} from '../utils/ui';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Options for the 'validate' command
 */
export interface ValidateOptions {
  /** Validate only the root configuration */
  root?: boolean;
}

/**
 * Validate filelinks configuration files
 *
 * This command performs comprehensive validation on both root configuration
 * and link files. It checks for:
 *
 * Root configuration:
 * - Valid structure (linkFiles array exists)
 * - Valid watchType values
 * - No duplicate IDs in linkFiles
 * - No duplicate paths in linkFiles
 * - All paths end with valid link file names
 * - All referenced link files exist
 *
 * Link files:
 * - Valid structure (array of FileLinkConfig)
 * - Required fields (watch, target) are present and non-empty
 * - Valid watchType values (uncommitted, unstaged, staged)
 * - No duplicate IDs within links
 * - Watch files exist and are files (not directories)
 * - Target files exist and are files (not directories)
 *
 * Exit codes:
 * - 0: All configurations are valid (warnings allowed)
 * - 1: Configuration has errors or not found
 *
 * @param file - Optional path to a specific link file to validate
 * @param options - Command options (root)
 * @returns Promise that resolves when validation is complete
 *
 * @example
 * // Validate all configurations
 * await validateCommand();
 *
 * @example
 * // Validate only root configuration
 * await validateCommand(undefined, { root: true });
 *
 * @example
 * // Validate a specific link file
 * await validateCommand('./path/to/filelinks.links.json');
 */
export async function validateCommand(file?: string, options: ValidateOptions = {}): Promise<void> {
  displayCommandHeader('validate', CLI_NAME);

  // If a specific file is provided, validate only that file
  if (file) {
    await validateSpecificFile(file);
    return;
  }

  // Verify we're in a git repository
  const gitRoot = requireGitRepository(false, CLI_NAME);

  const rootConfigPath = path.join(gitRoot, ROOT_CONFIG_FILE_NAME);

  // Check if root config exists
  if (fs.existsSync(rootConfigPath)) {
    await validateWithRootConfig(rootConfigPath, gitRoot, options.root);
  } else {
    if (options.root) {
      displayError(ERROR_MESSAGES.NO_ROOT_CONFIG);
      displayDim(`  Run "${CLI_NAME} init" at repository root to create one.\n`);
      process.exit(1);
    }
    await validateLocalConfig();
  }
}

/**
 * Validate a specific link file
 *
 * @param filePath - Path to the link file to validate
 */
async function validateSpecificFile(filePath: string): Promise<void> {
  const absolutePath = path.resolve(filePath);

  displayFilePath('Link File', absolutePath);

  // Determine git root for security checks
  const gitRoot = findGitRoot(path.dirname(absolutePath));

  // Validate the file path (exists, is file, correct name, within repo)
  const pathValidation = validateLinkFilePath(filePath, gitRoot || undefined);
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

  // Determine base directory for resolving paths in link configs
  const baseDir = gitRoot || path.dirname(absolutePath);

  try {
    const links = configManager.loadConfig(absolutePath);
    const validation = validateLinksConfig(links, baseDir);

    if (validation.errors.length > 0) {
      displayError('Link file has errors:\n');
      printIssues(validation.errors);
      displayBlankLine();
      process.exit(1);
    } else {
      displaySuccess(`Valid (${links.length} link(s))`);
    }

    if (validation.warnings.length > 0) {
      displayBlankLine();
      displayWarning('Warnings:\n');
      printIssues(validation.warnings);
    }

    displayBlankLine();
  } catch (error) {
    displayError(ERROR_MESSAGES.VALIDATION_FAILED);
    console.error(chalk.red('  Error:'), error instanceof Error ? error.message : error);
    displayBlankLine();
    process.exit(1);
  }
}

/**
 * Validate configuration using root config
 *
 * @param rootConfigPath - Path to root configuration file
 * @param gitRoot - Git repository root path
 * @param rootOnly - If true, only validate the root config, not the link files
 */
async function validateWithRootConfig(
  rootConfigPath: string,
  gitRoot: string,
  rootOnly?: boolean
): Promise<void> {
  displayFilePath('Root Configuration', rootConfigPath);

  let hasErrors = false;

  try {
    // Parse the TypeScript config file
    const rootConfig = parseRootConfig(rootConfigPath);

    // Validate root config
    const rootValidation = validateRootConfig(rootConfig, gitRoot);

    if (rootValidation.errors.length > 0) {
      hasErrors = true;
      displayError('Root configuration has errors:\n');
      printIssues(rootValidation.errors);
    } else {
      displaySuccess(SUCCESS_MESSAGES.ROOT_CONFIG_VALID);
    }

    if (rootValidation.warnings.length > 0) {
      displayBlankLine();
      displayWarning('Warnings:\n');
      printIssues(rootValidation.warnings);
    }

    // If rootOnly flag is set, skip link file validation
    if (rootOnly) {
      displayBlankLine();
      displayBlankLine();
      displayHeader('Summary:');
      if (hasErrors) {
        displayError('Root configuration has errors\n');
        process.exit(1);
      } else {
        displaySuccess('Root configuration is valid\n');
      }
      return;
    }

    // Validate each link file
    if (rootConfig.linkFiles && rootConfig.linkFiles.length > 0) {
      displayBlankLine();
      displayBlankLine();
      displayHeader('Link Files:\n');

      const validationResult = await validateLinkFiles(rootConfig, gitRoot);
      if (validationResult.hasErrors) {
        hasErrors = true;
      }
    }
  } catch (error) {
    hasErrors = true;
    displayError(
      `${ERROR_MESSAGES.ROOT_CONFIG_PARSE_ERROR}: ${error instanceof Error ? error.message : error}\n`
    );
  }

  // Summary
  displayHeader('Summary:');
  if (hasErrors) {
    displayError('Validation failed - please fix the errors above\n');
    process.exit(1);
  } else {
    displaySuccess('All configurations are valid\n');
  }
}

/**
 * Validate local configuration (no root config)
 */
async function validateLocalConfig(): Promise<void> {
  displayWarning(ERROR_MESSAGES.NO_ROOT_CONFIG);
  displayDim(`  Run "${CLI_NAME} init" at repository root to create one\n`);

  const configPath = configManager.findConfigFile();

  if (!configPath) {
    displayError('No link file found');
    displayDim(`  Run "${CLI_NAME} new" to create one\n`);
    process.exit(1);
  }

  displayFilePath('Link File', configPath);

  try {
    const links = configManager.loadConfig(configPath);
    // Paths are relative to git root, not link file directory
    const gitRoot = findGitRoot();
    if (!gitRoot) {
      displayError(ERROR_MESSAGES.GIT_ROOT_NOT_FOUND);
      process.exit(1);
    }
    const validation = validateLinksConfig(links, gitRoot);

    if (validation.errors.length > 0) {
      displayError('Link file has errors:\n');
      printIssues(validation.errors);
      displayBlankLine();
      process.exit(1);
    } else {
      displaySuccess(`Valid (${links.length} link(s))`);
    }

    if (validation.warnings.length > 0) {
      displayBlankLine();
      displayWarning('Warnings:\n');
      printIssues(validation.warnings);
    }

    displayBlankLine();
  } catch (error) {
    displayError(ERROR_MESSAGES.VALIDATION_FAILED);
    console.error(chalk.red('  Error:'), error instanceof Error ? error.message : error);
    displayBlankLine();
    process.exit(1);
  }
}

/**
 * Print validation issues with optional indentation
 *
 * @param issues - Array of validation issues to print
 * @param indent - Optional indentation prefix
 */
function printIssues(issues: ValidationIssue[], indent: string = '  '): void {
  displayIssues(issues, indent);
}
