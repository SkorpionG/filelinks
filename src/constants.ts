/**
 * Global constants for the filelinks CLI
 */

/**
 * The name of the CLI tool
 * Used in help messages, error messages, and generated files
 */
export const CLI_NAME = 'filelinks';

/**
 * Supported file names for link definition files (JSON format)
 * These files contain arrays of FileLinkConfig objects
 */
export const LINK_FILE_NAMES = [
  'filelinks.links.json',
  '.filelinksrc.json',
  '.filelinksrc',
] as const;

/**
 * The default link file name to create
 */
export const DEFAULT_LINK_FILE_NAME = LINK_FILE_NAMES[0]; // 'filelinks.links.json'

/**
 * Root configuration file name (TypeScript)
 * This file references all link files in the repository
 */
export const ROOT_CONFIG_FILE_NAME = 'filelinks.config.ts';

/**
 * Patterns to ignore when scanning for link files
 */
export const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
] as const;
