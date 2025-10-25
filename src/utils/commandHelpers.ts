import { isInGitRepo, findGitRoot, isGitRoot } from './git';
import { displayGitRepoRequired, displayGitRootNotFound, displayNotAtGitRoot } from './ui';

/**
 * Require that the current directory is in a git repository, exit if not
 *
 * This is a convenience function that checks if we're in a git repository
 * and optionally if we're at the repository root. If the checks fail, it
 * prints an error message and exits the process.
 *
 * Use this at the start of commands that require git repository context.
 *
 * @param requireRoot - If true, also requires that we're at the repository root
 * @param cliName - The CLI name to use in error messages
 * @returns The git repository root path
 * @throws Never returns if checks fail (calls process.exit)
 *
 * @example
 * ```typescript
 * // In a command that needs git repo
 * const gitRoot = requireGitRepository(false, 'filelinks');
 * // Now we know we're in a repo
 *
 * // In a command that must be run at repo root (like init)
 * const gitRoot = requireGitRepository(true, 'filelinks');
 * ```
 */
export function requireGitRepository(requireRoot: boolean, cliName: string): string {
  const currentDir = process.cwd();

  // Check if we're in a git repository
  if (!isInGitRepo(currentDir)) {
    displayGitRepoRequired(cliName);
    process.exit(1);
  }

  // Find git root
  const gitRoot = findGitRoot(currentDir);
  if (!gitRoot) {
    displayGitRootNotFound();
    process.exit(1);
  }

  // If root is required, check that we're at the root
  if (requireRoot && !isGitRoot(currentDir)) {
    displayNotAtGitRoot(gitRoot, currentDir, cliName);
    process.exit(1);
  }

  return gitRoot;
}
