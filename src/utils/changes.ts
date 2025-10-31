import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { WatchType } from '../types';
import * as path from 'path';

/**
 * Git change detection utilities for filelinks
 */

/**
 * Get changed files based on watch type
 *
 * @param watchType - Type of changes to detect (uncommitted, unstaged, staged)
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Promise resolving to array of changed file paths (relative to repo root)
 */
export async function getChangedFiles(
  watchType: WatchType = 'uncommitted',
  cwd: string = process.cwd()
): Promise<string[]> {
  const git: SimpleGit = simpleGit(cwd);

  try {
    const status: StatusResult = await git.status();

    switch (watchType) {
      case 'uncommitted':
        // All changes not yet committed (staged + unstaged)
        return [
          ...status.modified,
          ...status.created,
          ...status.deleted,
          ...status.renamed.map((r) => r.to),
          ...status.not_added,
        ].filter((file, index, self) => self.indexOf(file) === index); // Remove duplicates

      case 'unstaged':
        // Only unstaged changes (modified but not staged, and untracked files)
        return [
          ...status.modified.filter((file) => !status.staged.includes(file)),
          ...status.not_added,
        ].filter((file, index, self) => self.indexOf(file) === index);

      case 'staged':
        // Only staged changes
        return status.staged;

      default:
        return [];
    }
  } catch (error) {
    throw new Error(
      `Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a file matches a pattern
 * Supports glob-like patterns with * and **
 *
 * @param filePath - File path to check
 * @param pattern - Pattern to match against
 * @returns True if file matches pattern
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize paths to use forward slashes
  const normalizedFile = filePath.split(path.sep).join('/');
  const normalizedPattern = pattern.split(path.sep).join('/');

  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    // First, escape all special regex characters (except glob wildcards * and ?)
    .replace(/[\\^$.|+(){}]/g, '\\$&') // Escape most special chars
    .replace(/\[/g, '\\[') // Escape opening bracket
    .replace(/\]/g, '\\]') // Escape closing bracket
    // Then, convert glob patterns to regex
    .replace(/\*\*/g, '§§§') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/§§§/g, '.*') // ** matches anything including /
    .replace(/\?/g, '.'); // ? matches single character

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedFile);
}

/**
 * Check if any changed files match the watch patterns
 *
 * @param changedFiles - Array of changed file paths
 * @param watchPatterns - Array of patterns to match against
 * @returns Array of changed files that match the patterns
 */
export function findMatchingFiles(changedFiles: string[], watchPatterns: string[]): string[] {
  const matches: string[] = [];

  for (const file of changedFiles) {
    for (const pattern of watchPatterns) {
      if (matchesPattern(file, pattern)) {
        matches.push(file);
        break; // File matched, no need to check other patterns
      }
    }
  }

  return matches;
}

/**
 * Get information about the last commit affecting a file
 *
 * @param filePath - Path to the file
 * @param cwd - Working directory
 * @returns Promise resolving to commit info or null
 */
export async function getLastCommitInfo(
  filePath: string,
  cwd: string = process.cwd()
): Promise<{ hash: string; message: string; author: string; date: string } | null> {
  const git: SimpleGit = simpleGit(cwd);

  try {
    const log = await git.log({ file: filePath, maxCount: 1 });

    if (log.latest) {
      return {
        hash: log.latest.hash.substring(0, 7), // Short hash
        message: log.latest.message,
        author: log.latest.author_name,
        date: log.latest.date,
      };
    }

    return null;
  } catch {
    // File might not be committed yet
    return null;
  }
}
