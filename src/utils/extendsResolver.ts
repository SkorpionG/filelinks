import * as fs from 'fs';
import * as path from 'path';
import { FileLinkConfig, FileLinkConfigArray } from '../types';
import { LINK_FILE_NAMES } from '../constants';

/**
 * Result of resolving file-level extends
 */
export interface FileExtendsResolutionResult {
  /** All links from the extended file(s) */
  links: FileLinkConfigArray;
  /** Any errors encountered during resolution */
  errors: string[];
  /** Any warnings encountered during resolution */
  warnings: string[];
  /** Whether circular reference was detected */
  hasCircularReference: boolean;
}

/**
 * Resolve file-level extends to load all links from referenced files
 *
 * This function:
 * - Loads ALL links from the extended file
 * - Recursively resolves any extends in those files
 * - Detects and prevents circular references
 * - Returns all links that should be included
 *
 * Path resolution supports both relative and root-relative paths:
 * - First tries resolving relative to baseDir (for paths like ./marketing/file.json)
 * - If that fails and gitRoot is provided, tries resolving relative to gitRoot
 *   (for paths like apps/web/components/marketing/file.json)
 *
 * @param extendsPath - Path to the file to extend from
 * @param baseDir - The base directory for resolving relative paths (usually the link file's directory)
 * @param visitedPaths - Set of already visited paths (for circular reference detection)
 * @param gitRoot - Optional git root directory for resolving root-relative paths
 * @returns Resolution result with all links from extended file(s)
 */
export function resolveFileExtends(
  extendsPath: string,
  baseDir: string,
  visitedPaths: Set<string> = new Set(),
  gitRoot?: string
): FileExtendsResolutionResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allLinks: FileLinkConfigArray = [];

  // Try resolving the extends path relative to baseDir first
  let absolutePath = path.resolve(baseDir, extendsPath);
  let normalizedPath = path.normalize(absolutePath);

  // If file doesn't exist and gitRoot is provided, try resolving relative to gitRoot
  // This supports both relative paths (./marketing/file.json) and
  // root-relative paths (apps/web/components/marketing/file.json)
  if (!fs.existsSync(absolutePath) && gitRoot && gitRoot !== baseDir) {
    const gitRootPath = path.resolve(gitRoot, extendsPath);
    if (fs.existsSync(gitRootPath)) {
      absolutePath = gitRootPath;
      normalizedPath = path.normalize(absolutePath);
    }
  }

  // Validate file name
  const fileName = path.basename(extendsPath);
  const validNames = LINK_FILE_NAMES as readonly string[];
  if (!validNames.includes(fileName)) {
    return {
      links: [],
      errors: [
        `Extends file must have a valid link file name (${LINK_FILE_NAMES.join(', ')}). Got: "${fileName}"`,
      ],
      warnings,
      hasCircularReference: false,
    };
  }

  // Check for circular reference BEFORE checking if file exists
  // This ensures we catch self-references and circular chains early
  if (visitedPaths.has(normalizedPath)) {
    return {
      links: [],
      errors: [
        `Circular reference detected: "${extendsPath}" has already been processed in the extends chain`,
      ],
      warnings,
      hasCircularReference: true,
    };
  }

  // Check if extends file exists
  if (!fs.existsSync(absolutePath)) {
    return {
      links: [],
      errors: [`Extends file does not exist: "${extendsPath}"`],
      warnings,
      hasCircularReference: false,
    };
  }

  // Check if extends file is a file
  if (!fs.statSync(absolutePath).isFile()) {
    return {
      links: [],
      errors: [`Extends path is not a file: "${extendsPath}"`],
      warnings,
      hasCircularReference: false,
    };
  }

  // Add current path to visited set AFTER all checks
  const newVisitedPaths = new Set(visitedPaths);
  newVisitedPaths.add(normalizedPath);

  // Load the extends file
  let extendsConfig: FileLinkConfig[];
  try {
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    extendsConfig = JSON.parse(fileContent);
  } catch (error) {
    return {
      links: [],
      errors: [
        `Failed to parse extends file "${extendsPath}": ${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings,
      hasCircularReference: false,
    };
  }

  // Validate that extends file contains an array
  if (!Array.isArray(extendsConfig)) {
    return {
      links: [],
      errors: [`Extends file "${extendsPath}" must export an array of link configurations`],
      warnings,
      hasCircularReference: false,
    };
  }

  // Process each link in the extended file
  const extendedFileBaseDir = path.dirname(absolutePath);

  for (const link of extendsConfig) {
    // If this link also has extends, resolve it recursively
    if (link.extends) {
      const nestedResult = resolveFileExtends(
        link.extends,
        extendedFileBaseDir,
        newVisitedPaths,
        gitRoot
      );

      if (nestedResult.hasCircularReference) {
        return {
          links: [],
          errors: [...errors, ...nestedResult.errors],
          warnings: [...warnings, ...nestedResult.warnings],
          hasCircularReference: true,
        };
      }

      if (nestedResult.errors.length > 0) {
        errors.push(...nestedResult.errors);
      }

      warnings.push(...nestedResult.warnings);
      allLinks.push(...nestedResult.links);
    } else {
      // Regular link without extends - add it directly
      allLinks.push(link);
    }
  }

  return {
    links: allLinks,
    errors,
    warnings,
    hasCircularReference: false,
  };
}

/**
 * Legacy function for backward compatibility
 * This was the original extends behavior (property inheritance)
 * Keeping it for now in case it's needed
 */
export interface ExtendsResolutionResult {
  /** The resolved link configuration */
  resolved?: FileLinkConfig;
  /** Any errors encountered during resolution */
  errors: string[];
  /** Any warnings encountered during resolution */
  warnings: string[];
  /** Whether circular reference was detected */
  hasCircularReference: boolean;
}

export function resolveExtends(
  link: FileLinkConfig,
  baseDir: string,
  visitedPaths: Set<string> = new Set(),
  gitRoot?: string
): ExtendsResolutionResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // If no extends, return the link as-is
  if (!link.extends) {
    return {
      resolved: link,
      errors,
      warnings,
      hasCircularReference: false,
    };
  }

  // Use the new file-level extends resolution
  const result = resolveFileExtends(link.extends, baseDir, visitedPaths, gitRoot);

  if (result.hasCircularReference || result.errors.length > 0) {
    return {
      resolved: undefined,
      errors: result.errors,
      warnings: result.warnings,
      hasCircularReference: result.hasCircularReference,
    };
  }

  // For backward compatibility, if there are links, use the first one
  // and merge with the current link's properties
  if (result.links.length > 0) {
    const baseLink = result.links[0];
    const merged = mergeConfigs(baseLink, link);
    return {
      resolved: merged,
      errors: result.errors,
      warnings: result.warnings,
      hasCircularReference: false,
    };
  }

  return {
    resolved: link,
    errors: ['Extends file is empty'],
    warnings: result.warnings,
    hasCircularReference: false,
  };
}

/**
 * Merge two link configurations
 * The child config takes precedence over the base config
 *
 * @param base - The base configuration (from extends file)
 * @param child - The child configuration (current link)
 * @returns Merged configuration
 */
function mergeConfigs(base: FileLinkConfig, child: FileLinkConfig): FileLinkConfig {
  return {
    // Use child's properties if defined, otherwise use base's
    id: child.id ?? base.id,
    name: child.name ?? base.name,
    description: child.description ?? base.description,
    // Don't inherit extends from base
    watch: child.watch && child.watch.length > 0 ? child.watch : base.watch,
    target: child.target && child.target.length > 0 ? child.target : base.target,
    watchType: child.watchType ?? base.watchType,
  };
}
