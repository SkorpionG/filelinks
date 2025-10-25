import * as fs from 'fs';
import * as path from 'path';
import { LINK_FILE_NAMES } from '../constants';

/**
 * Result of link file path validation
 */
export interface LinkFileValidationResult {
  valid: boolean;
  error?: string;
  errorDetails?: string[];
}

/**
 * Validate a link file path for security and correctness
 *
 * This function performs comprehensive validation on a link file path:
 * - Checks if the file exists
 * - Ensures it's a file, not a directory
 * - Validates the filename matches accepted link file names
 * - Ensures the file is within the repository (security check)
 *
 * @param filePath - Path to the link file (can be relative or absolute)
 * @param gitRoot - Git repository root directory (optional, will be detected if not provided)
 * @returns Validation result with error details if invalid
 *
 * @example
 * const result = validateLinkFilePath('./examples/filelinks.links.json', '/repo/root');
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function validateLinkFilePath(filePath: string, gitRoot?: string): LinkFileValidationResult {
  const absolutePath = path.resolve(filePath);
  const filename = path.basename(absolutePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    return {
      valid: false,
      error: 'File not found',
      errorDetails: [`The file does not exist: ${absolutePath}`],
    };
  }

  // Check if it's a file (not a directory)
  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    return {
      valid: false,
      error: 'Path is a directory, not a file',
      errorDetails: [
        `Expected a link file, but got a directory: ${absolutePath}`,
        'Please specify the full path to a link file.',
      ],
    };
  }

  // Validate filename
  const validNames = LINK_FILE_NAMES as readonly string[];
  if (!validNames.includes(filename)) {
    return {
      valid: false,
      error: 'Invalid link file name',
      errorDetails: [
        'Link files must be named one of:',
        ...validNames.map((name) => `  • ${name}`),
        '',
        `Got: ${filename}`,
      ],
    };
  }

  // Security check: Ensure the file is within the repository
  if (gitRoot) {
    const relativePath = path.relative(gitRoot, absolutePath);

    // Check if path escapes the repository
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return {
        valid: false,
        error: 'Security: File is outside the repository',
        errorDetails: [
          `Refusing to access file outside repository: ${filePath}`,
          `Repository root: ${gitRoot}`,
          `Resolved path: ${absolutePath}`,
          '',
          'All link files must be within the git repository.',
        ],
      };
    }
  }

  return { valid: true };
}

/**
 * Validate and normalize a link file path
 *
 * This is a convenience function that validates the path and returns
 * the absolute path if valid, or throws an error if invalid.
 *
 * @param filePath - Path to the link file
 * @param gitRoot - Git repository root directory (optional)
 * @returns Absolute path to the validated file
 * @throws Error if validation fails
 *
 * @example
 * try {
 *   const absolutePath = validateAndNormalizeLinkFilePath('./filelinks.links.json', gitRoot);
 *   // Use absolutePath
 * } catch (error) {
 *   console.error(error.message);
 * }
 */
export function validateAndNormalizeLinkFilePath(filePath: string, gitRoot?: string): string {
  const result = validateLinkFilePath(filePath, gitRoot);

  if (!result.valid) {
    const message = [result.error, '', ...(result.errorDetails || [])].join('\n');
    throw new Error(message);
  }

  return path.resolve(filePath);
}
