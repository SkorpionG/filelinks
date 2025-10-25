/**
 * Core types for filelinks
 */

/**
 * Type of git changes to watch for
 */
export type WatchType = 'uncommitted' | 'unstaged' | 'staged';

/**
 * A single file link configuration
 * Defines which files to watch and which targets should be updated
 */
export interface FileLinkConfig {
  /** Unique identifier for this link */
  id?: string;
  /** Human-readable name */
  name?: string;
  /** Description of what this link ensures */
  description?: string;
  /** File patterns to watch for changes */
  watch: string[];
  /** Files that should be updated when watch files change */
  target: string[];
  /** Type of git changes to detect */
  watchType?: WatchType;
}

/**
 * Array of file link configurations (stored in .links.json files)
 */
export type FileLinkConfigArray = FileLinkConfig[];

/**
 * Reference to a link file in the root configuration
 */
export interface LinkFileReference {
  /** Unique identifier for this link file (used in CLI commands) */
  id: string;
  /** Human-readable name for this link file */
  name: string;
  /** Path to the .links.json file (relative to root config) */
  path: string;
}

/**
 * Partial link file reference that may be incomplete during parsing
 */
export interface PartialLinkFileReference {
  id?: string;
  name?: string;
  path?: string;
}

/**
 * Root configuration structure (filelinks.config.ts)
 * This file references all link files in the repository
 */
export interface RootConfig {
  /** Array of link file references */
  linkFiles: LinkFileReference[];
}

/**
 * Parsed root configuration that may contain partial/invalid entries
 * Used during parsing and validation stages
 */
export interface ParsedRootConfig {
  /** Array of link file references (may be partial/incomplete) */
  linkFiles: PartialLinkFileReference[];
}

/**
 * Type for the default export of filelinks.config.ts
 */
export type RootConfigExport = RootConfig;
