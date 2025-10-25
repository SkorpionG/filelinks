import * as fs from 'fs';
import * as path from 'path';

/**
 * Git repository utilities for filelinks
 */

/**
 * Find the root directory of the git repository
 * Searches upward from the given directory until .git is found
 *
 * @param startDir - The directory to start searching from (defaults to current working directory)
 * @returns The path to the git repository root, or null if not in a git repository
 */
export function findGitRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (true) {
    const gitDir = path.join(currentDir, '.git');

    // Check if .git exists (could be a directory or a file for worktrees/submodules)
    if (fs.existsSync(gitDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    // Reached filesystem root without finding .git
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

/**
 * Check if the current directory is inside a git repository
 *
 * @param dir - The directory to check (defaults to current working directory)
 * @returns true if inside a git repository, false otherwise
 */
export function isInGitRepo(dir: string = process.cwd()): boolean {
  return findGitRoot(dir) !== null;
}

/**
 * Check if the current directory is the root of a git repository
 *
 * @param dir - The directory to check (defaults to current working directory)
 * @returns true if the directory is a git repository root, false otherwise
 */
export function isGitRoot(dir: string = process.cwd()): boolean {
  const gitDir = path.join(dir, '.git');
  return fs.existsSync(gitDir);
}

/**
 * Get the relative path from the git repository root to the given directory
 *
 * @param dir - The directory to get the relative path for (defaults to current working directory)
 * @returns The relative path from git root, or null if not in a git repository
 */
export function getRelativePathFromGitRoot(dir: string = process.cwd()): string | null {
  const gitRoot = findGitRoot(dir);

  if (!gitRoot) {
    return null;
  }

  const relativePath = path.relative(gitRoot, dir);

  // If at root, return empty string instead of '.'
  return relativePath === '' ? '' : relativePath;
}
