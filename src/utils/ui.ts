import chalk from 'chalk';
import type { ValidationResult, ValidationIssue } from './validation';

/**
 * UI utility module for consistent console output
 *
 * This module provides standardized functions for displaying messages,
 * errors, warnings, and other UI elements in the CLI.
 */

/**
 * Display a command header with consistent styling
 */
export function displayCommandHeader(commandName: string, cliName: string): void {
  console.log(chalk.bold.blue(`${cliName} ${commandName}\n`));
}

/**
 * Display a simple header with consistent styling
 */
export function displayHeader(text: string): void {
  console.log(chalk.bold(text));
}

/**
 * Display a success message with checkmark
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display an error message with X mark
 */
export function displayError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Display a warning message with warning symbol
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Display dimmed/secondary text
 */
export function displayDim(message: string): void {
  console.log(chalk.dim(message));
}

/**
 * Display an info message
 */
export function displayInfo(message: string): void {
  console.log(message);
}

/**
 * Display an error and exit the process
 */
export function displayErrorAndExit(
  message: string,
  details?: string[],
  exitCode: number = 1
): never {
  displayError(message);
  if (details) {
    details.forEach((detail) => {
      displayDim(`  ${detail}`);
    });
  }
  console.log();
  process.exit(exitCode);
}

/**
 * Display a section with title and content
 */
export function displaySection(title: string, content?: string): void {
  console.log(chalk.bold(`\n${title}`));
  if (content) {
    displayDim(`  ${content}`);
  }
}

/**
 * Display a list of items with consistent formatting
 */
export function displayList(items: string[], bullet: string = '•'): void {
  items.forEach((item) => {
    displayDim(`  ${bullet} ${item}`);
  });
}

/**
 * Display validation issues (errors or warnings)
 */
export function displayIssues(issues: ValidationIssue[], indent: string = ''): void {
  issues.forEach((issue) => {
    const contextStr = issue.context ? ` (${issue.context})` : '';
    console.log(`${indent}• ${issue.message}${contextStr}`);
  });
}

/**
 * Display validation result with appropriate styling
 */
export function displayValidationResult(result: ValidationResult, title?: string): void {
  if (title) {
    displayHeader(title);
  }

  if (result.errors.length > 0) {
    displayError('Validation errors:\n');
    displayIssues(result.errors);
  } else if (result.valid) {
    displaySuccess('Validation passed');
  }

  if (result.warnings.length > 0) {
    console.log();
    displayWarning('Warnings:\n');
    displayIssues(result.warnings);
  }
}

/**
 * Display available link file IDs
 */
export function displayAvailableLinkFileIds(linkFiles: Array<{ id: string; name: string }>): void {
  displayDim('\nAvailable IDs:');
  linkFiles.forEach((lf) => {
    displayDim(`  • ${lf.id} - ${lf.name}`);
  });
  console.log();
}

/**
 * Display a link file reference with consistent formatting
 */
export function displayLinkFileReference(name: string, id: string, path: string): void {
  console.log(chalk.bold(`${name} (${id}):`));
  displayDim(`  ${path}\n`);
}

/**
 * Display a summary section
 */
export function displaySummary(items: Array<{ label: string; value: string | number }>): void {
  console.log(chalk.bold('\nSummary:'));
  items.forEach((item) => {
    displayDim(`  ${item.label}: ${item.value}`);
  });
  console.log();
}

/**
 * Display a file path with label
 */
export function displayFilePath(label: string, filePath: string): void {
  console.log(chalk.bold(`${label}:`));
  displayDim(`  ${filePath}\n`);
}

/**
 * Display colored text based on status
 */
export function displayStatus(text: string, exists: boolean): void {
  if (exists) {
    console.log(chalk.magenta(`    • ${text}`));
  } else {
    console.log(chalk.magenta(`    • ${text} `) + chalk.red('(not found)'));
  }
}

/**
 * Display a numbered or bulleted list with title
 */
export function displayInstructionList(title: string, instructions: string[]): void {
  displayHeader(title);
  instructions.forEach((instruction) => {
    displayDim(`  • ${instruction}`);
  });
  console.log();
}

/**
 * Display scanning/processing message
 */
export function displayProcessing(message: string): void {
  displayDim(`${message}...\n`);
}

/**
 * Display a blank line for spacing
 */
export function displayBlankLine(): void {
  console.log();
}

/**
 * Display validation errors for a specific link file
 */
export function displayLinkFileValidationErrors(
  linkFileName: string,
  errors: ValidationIssue[]
): void {
  console.log(chalk.yellow(`\n⚠ Link file "${linkFileName}" has validation errors:`));
  errors.forEach((err) => {
    const contextStr = err.context ? ` (${err.context})` : '';
    console.log(chalk.yellow(`  • ${err.message}${contextStr}`));
  });
  displayDim('Skipping invalid links in this file...\n');
}

/**
 * Display validation warnings for a specific link file
 */
export function displayLinkFileValidationWarnings(
  linkFileName: string,
  warnings: ValidationIssue[]
): void {
  console.log(chalk.yellow(`\n⚠ Link file "${linkFileName}" has warnings:`));
  warnings.forEach((warning) => {
    const contextStr = warning.context ? ` (${warning.context})` : '';
    console.log(chalk.yellow(`  • ${warning.message}${contextStr}`));
  });
  console.log();
}

/**
 * Display root config validation errors
 */
export function displayRootConfigValidationErrors(errors: ValidationIssue[]): void {
  console.log(chalk.yellow('\n⚠ Root configuration has validation errors:'));
  errors.forEach((err) => {
    const contextStr = err.context ? ` (${err.context})` : '';
    console.log(chalk.yellow(`  • ${err.message}${contextStr}`));
  });
  displayDim('\nSkipping invalid entries...\n');
}

/**
 * Display a "not found" error for ID
 */
export function displayIdNotFound(
  id: string,
  availableIds: Array<{ id: string; name: string }>
): void {
  displayError(`No link file found with ID: ${id}`);
  displayAvailableLinkFileIds(availableIds);
}

/**
 * Display git repository requirement message
 */
export function displayGitRepoRequired(cliName: string): void {
  displayError('Not in a git repository');
  displayDim(`  ${cliName} requires a git repository.\n`);
}

/**
 * Display git root not found error
 */
export function displayGitRootNotFound(): void {
  displayError('Could not find git repository root');
}

/**
 * Display not at git root error with helpful information
 */
export function displayNotAtGitRoot(gitRoot: string, currentDir: string, cliName: string): void {
  displayError('Not at git repository root');
  displayDim(`  Git repository root: ${gitRoot}`);
  displayDim(`  Current directory: ${currentDir}`);
  displayDim('  Please run this command from the repository root.\n');
  console.log(chalk.bold('To create a link file in a subdirectory, use:'));
  displayDim(`  ${cliName} new\n`);
}
