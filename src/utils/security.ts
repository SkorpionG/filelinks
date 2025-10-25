import * as path from 'path';

/**
 * Result of a security check
 */
export interface SecurityCheckResult {
  /** Whether the check passed */
  isValid: boolean;
  /** Error message if check failed */
  error?: string;
  /** Additional error details */
  errorDetails?: string[];
}

/**
 * Verify that a path is within the repository boundaries
 *
 * This function performs a security check to ensure that a given file path
 * is within the git repository and not attempting path traversal attacks.
 *
 * Security checks:
 * - Path must not traverse outside repository (no "..")
 * - Path must not be an absolute path escaping repository
 * - Path is resolved and checked against repository root
 *
 * @param filePath - The file path to check (can be relative or absolute)
 * @param gitRoot - The git repository root directory
 * @returns SecurityCheckResult indicating if path is valid
 *
 * @example
 * ```typescript
 * const result = isWithinRepository('./src/file.ts', '/repo');
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 * ```
 */
export function isWithinRepository(filePath: string, gitRoot: string): SecurityCheckResult {
  try {
    // Resolve both paths to absolute
    const absoluteFilePath = path.resolve(filePath);
    const absoluteGitRoot = path.resolve(gitRoot);

    // Calculate relative path from git root to file
    const relativePath = path.relative(absoluteGitRoot, absoluteFilePath);

    // Check if path goes outside repository
    // - Paths starting with ".." go to parent directories
    // - Absolute paths after relative() indicate the file is on a different root
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return {
        isValid: false,
        error: 'Path points outside the git repository',
        errorDetails: [`Repository root: ${absoluteGitRoot}`, `Resolved path: ${absoluteFilePath}`],
      };
    }

    return {
      isValid: true,
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate path security',
      errorDetails: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Verify that a path is within repository and throw if not
 *
 * Convenience function that throws an error if the security check fails.
 * Use this when you want to halt execution on security violations.
 *
 * @param filePath - The file path to check
 * @param gitRoot - The git repository root directory
 * @throws Error if path is outside repository
 *
 * @example
 * ```typescript
 * try {
 *   requireWithinRepository('./src/file.ts', '/repo');
 *   // Path is safe, continue processing
 * } catch (error) {
 *   console.error('Security violation:', error);
 * }
 * ```
 */
export function requireWithinRepository(filePath: string, gitRoot: string): void {
  const result = isWithinRepository(filePath, gitRoot);
  if (!result.isValid) {
    const errorMsg = result.error || 'Security check failed';
    const details = result.errorDetails?.join('\n  ') || '';
    throw new Error(`${errorMsg}\n  ${details}`);
  }
}
