import * as fs from 'fs';
import * as path from 'path';
import { RootConfig, ParsedRootConfig, FileLinkConfigArray, WatchType } from '../types';
import { LINK_FILE_NAMES } from '../constants';

/**
 * Validation error or warning
 */
export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  context?: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Validate root configuration structure and constraints
 *
 * Checks:
 * - Structure is valid (linkFiles array exists)
 * - No duplicate IDs in linkFiles
 * - No duplicate paths in linkFiles
 * - All paths end with valid link file names
 * - All referenced link files exist
 *
 * @param rootConfig - The root configuration to validate (can be ParsedRootConfig with partial entries)
 * @param rootDir - The root directory where config is located
 * @returns Validation result with errors and warnings
 */
export function validateRootConfig(
  rootConfig: RootConfig | ParsedRootConfig,
  rootDir: string
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check structure
  if (!rootConfig.linkFiles) {
    errors.push({
      type: 'error',
      message: 'Root config must have a "linkFiles" property',
    });
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(rootConfig.linkFiles)) {
    errors.push({
      type: 'error',
      message: '"linkFiles" must be an array',
    });
    return { valid: false, errors, warnings };
  }

  // Check for empty linkFiles
  if (rootConfig.linkFiles.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'No link files configured in root config',
    });
  }

  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const pathToFirstIndex = new Map<string, number>(); // Map absolute path to first occurrence index

  rootConfig.linkFiles.forEach((linkFile, index) => {
    const context = `linkFiles[${index}]`;

    // Validate structure - check if linkFile is an object
    if (!linkFile || typeof linkFile !== 'object') {
      errors.push({
        type: 'error',
        message: 'Each linkFile must be an object',
        context,
      });
      return;
    }

    // Validate id
    if (linkFile.id === undefined || linkFile.id === null) {
      errors.push({
        type: 'error',
        message: 'Each linkFile must have an "id" property',
        context,
      });
    } else if (typeof linkFile.id !== 'string') {
      errors.push({
        type: 'error',
        message: '"id" must be a string',
        context,
      });
    } else if (linkFile.id.trim() === '') {
      errors.push({
        type: 'error',
        message: '"id" cannot be an empty string',
        context,
      });
    }

    // Validate name
    if (linkFile.name === undefined || linkFile.name === null) {
      errors.push({
        type: 'error',
        message: 'Each linkFile must have a "name" property',
        context,
      });
    } else if (typeof linkFile.name !== 'string') {
      errors.push({
        type: 'error',
        message: '"name" must be a string',
        context,
      });
    } else if (linkFile.name.trim() === '') {
      errors.push({
        type: 'error',
        message: '"name" cannot be an empty string',
        context,
      });
    }

    // Validate path
    if (linkFile.path === undefined || linkFile.path === null) {
      errors.push({
        type: 'error',
        message: 'Each linkFile must have a "path" property',
        context,
      });
      return;
    } else if (typeof linkFile.path !== 'string') {
      errors.push({
        type: 'error',
        message: '"path" must be a string',
        context,
      });
      return;
    } else if (linkFile.path.trim() === '') {
      errors.push({
        type: 'error',
        message: '"path" cannot be an empty string',
        context,
      });
      return;
    }

    // Security check: Ensure the path doesn't escape the repository
    const resolvedPath = path.resolve(rootDir, linkFile.path);
    const relativePath = path.relative(rootDir, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      errors.push({
        type: 'error',
        message: `Path "${linkFile.path}" points outside the repository. All link files must be within the repository.`,
        context,
      });
      return; // Don't continue validation for paths outside repo
    }

    // Check for duplicate IDs (only if id is valid)
    if (linkFile.id && typeof linkFile.id === 'string' && linkFile.id.trim() !== '') {
      if (seenIds.has(linkFile.id)) {
        errors.push({
          type: 'error',
          message: `Duplicate link file ID: "${linkFile.id}"`,
          context,
        });
      }
      seenIds.add(linkFile.id);
    }

    // Check for duplicate paths using absolute path resolution
    if (seenPaths.has(resolvedPath)) {
      const firstIndex = pathToFirstIndex.get(resolvedPath);
      if (firstIndex !== undefined) {
        errors.push({
          type: 'error',
          message: `Duplicate link file path: "${linkFile.path}" points to the same file as linkFiles[${firstIndex}]`,
          context,
        });
      }
    } else {
      seenPaths.add(resolvedPath);
      pathToFirstIndex.set(resolvedPath, index);
    }

    // Validate path ends with valid link file name
    const fileName = path.basename(linkFile.path);
    const validNames = LINK_FILE_NAMES as readonly string[];
    if (!validNames.includes(fileName)) {
      errors.push({
        type: 'error',
        message: `Path must end with a valid link file name (${LINK_FILE_NAMES.join(', ')}). Got: "${fileName}"`,
        context,
      });
    }

    // Check if file exists (reuse resolvedPath)
    if (!fs.existsSync(resolvedPath)) {
      errors.push({
        type: 'error',
        message: `Link file does not exist: "${linkFile.path}" (resolved to: ${resolvedPath})`,
        context,
      });
    } else if (!fs.statSync(resolvedPath).isFile()) {
      errors.push({
        type: 'error',
        message: `Link file path is not a file: "${linkFile.path}"`,
        context,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate links configuration structure and constraints
 *
 * Checks:
 * - Structure is valid (array of FileLinkConfig)
 * - Each link has required properties (watch, target)
 * - watchType is valid if specified
 * - No duplicate IDs in links
 * - All watch files exist and are files (not directories)
 * - All target files exist and are files (not directories)
 *
 * @param links - The links configuration to validate
 * @param baseDir - The base directory for resolving relative paths
 * @returns Validation result with errors and warnings
 */
export function validateLinksConfig(links: FileLinkConfigArray, baseDir: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!Array.isArray(links)) {
    errors.push({
      type: 'error',
      message: 'Links configuration must be an array',
    });
    return { valid: false, errors, warnings };
  }

  if (links.length === 0) {
    warnings.push({
      type: 'warning',
      message: 'No links configured in this file',
    });
  }

  const seenIds = new Set<string>();
  const seenLinkSignatures = new Map<string, number>(); // Map signature to first occurrence index

  links.forEach((link, index) => {
    const context = `links[${index}]`;

    // Validate required properties
    if (!link.watch || !Array.isArray(link.watch)) {
      errors.push({
        type: 'error',
        message: 'Each link must have a "watch" array property',
        context,
      });
    } else if (link.watch.length === 0) {
      errors.push({
        type: 'error',
        message: '"watch" array cannot be empty',
        context,
      });
    }

    if (!link.target || !Array.isArray(link.target)) {
      errors.push({
        type: 'error',
        message: 'Each link must have a "target" array property',
        context,
      });
    } else if (link.target.length === 0) {
      errors.push({
        type: 'error',
        message: '"target" array cannot be empty',
        context,
      });
    }

    // Validate watchType if specified
    if (link.watchType) {
      const validWatchTypes: WatchType[] = ['uncommitted', 'unstaged', 'staged'];
      if (!validWatchTypes.includes(link.watchType)) {
        errors.push({
          type: 'error',
          message: `Invalid watchType: "${link.watchType}". Must be one of: ${validWatchTypes.join(', ')}`,
          context,
        });
      }
    }

    // Check for duplicate IDs
    if (link.id) {
      if (seenIds.has(link.id)) {
        errors.push({
          type: 'error',
          message: `Duplicate link ID: "${link.id}"`,
          context,
        });
      }
      seenIds.add(link.id);
    }

    // Check for duplicate links (same watch, target, and watchType)
    if (link.watch && Array.isArray(link.watch) && link.target && Array.isArray(link.target)) {
      const watchType = link.watchType || 'uncommitted';
      const watchKey = [...link.watch].sort().join('|');
      const targetKey = [...link.target].sort().join('|');
      const signature = `${watchType}::${watchKey}::${targetKey}`;

      if (seenLinkSignatures.has(signature)) {
        const firstIndex = seenLinkSignatures.get(signature);
        if (firstIndex !== undefined) {
          warnings.push({
            type: 'warning',
            message: `Duplicate link: has the same watch, target, and watchType as links[${firstIndex}]. Only the first occurrence will be checked.`,
            context,
          });
        }
      } else {
        seenLinkSignatures.set(signature, index);
      }

      // Check if watch and target contain the same files
      // Filter out non-string values before normalizing
      const watchSet = new Set(
        link.watch.filter((w): w is string => typeof w === 'string').map((w) => path.normalize(w))
      );
      const targetSet = new Set(
        link.target.filter((t): t is string => typeof t === 'string').map((t) => path.normalize(t))
      );
      const intersection = [...watchSet].filter((w) => targetSet.has(w));

      if (intersection.length > 0) {
        errors.push({
          type: 'error',
          message: `Watch and target cannot point to the same file(s): ${intersection.join(', ')}`,
          context,
        });
      }
    }

    // Validate watch files exist and are files (not directories)
    if (link.watch && Array.isArray(link.watch)) {
      link.watch.forEach((watchPattern, watchIndex) => {
        if (typeof watchPattern !== 'string') {
          errors.push({
            type: 'error',
            message: `Watch pattern must be a string, got: ${typeof watchPattern}`,
            context: `${context}.watch[${watchIndex}]`,
          });
          return;
        }

        // Only validate if it's not a glob pattern (contains *, **, ?)
        if (!watchPattern.includes('*') && !watchPattern.includes('?')) {
          const absolutePath = path.resolve(baseDir, watchPattern);
          if (!fs.existsSync(absolutePath)) {
            warnings.push({
              type: 'warning',
              message: `Watch file does not exist: "${watchPattern}"`,
              context: `${context}.watch[${watchIndex}]`,
            });
          } else if (fs.statSync(absolutePath).isDirectory()) {
            errors.push({
              type: 'error',
              message: `Watch path is a directory, not a file: "${watchPattern}". Use glob patterns for directories (e.g., "${watchPattern}/**/*.js")`,
              context: `${context}.watch[${watchIndex}]`,
            });
          }
        }
      });
    }

    // Validate target files exist and are files (not directories)
    if (link.target && Array.isArray(link.target)) {
      link.target.forEach((targetPattern, targetIndex) => {
        if (typeof targetPattern !== 'string') {
          errors.push({
            type: 'error',
            message: `Target pattern must be a string, got: ${typeof targetPattern}`,
            context: `${context}.target[${targetIndex}]`,
          });
          return;
        }

        // Only validate if it's not a glob pattern (contains *, **, ?)
        if (!targetPattern.includes('*') && !targetPattern.includes('?')) {
          const absolutePath = path.resolve(baseDir, targetPattern);
          if (!fs.existsSync(absolutePath)) {
            warnings.push({
              type: 'warning',
              message: `Target file does not exist: "${targetPattern}"`,
              context: `${context}.target[${targetIndex}]`,
            });
          } else if (fs.statSync(absolutePath).isDirectory()) {
            errors.push({
              type: 'error',
              message: `Target path is a directory, not a file: "${targetPattern}". Use glob patterns for directories (e.g., "${targetPattern}/**/*.js")`,
              context: `${context}.target[${targetIndex}]`,
            });
          }
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Combine multiple validation results
 *
 * @param results - Array of validation results to combine
 * @returns Combined validation result
 */
export function combineValidationResults(results: ValidationResult[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  results.forEach((result) => {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
