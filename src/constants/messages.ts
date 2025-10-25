/**
 * Standard error messages used throughout the application
 */
export const ERROR_MESSAGES = {
  // Git repository errors
  NOT_IN_GIT_REPO: 'Not in a git repository',
  GIT_ROOT_NOT_FOUND: 'Could not find git repository root',
  NOT_AT_GIT_ROOT: 'Not at git repository root',

  // Configuration file errors
  CONFIG_FILE_EXISTS: 'Configuration file already exists',
  NO_ROOT_CONFIG: 'No root configuration found',
  ROOT_CONFIG_ERROR: 'Error loading root config',
  ROOT_CONFIG_PARSE_ERROR: 'Error parsing root config',

  // Link file errors
  LINK_FILE_NOT_FOUND: 'Link file not found',
  LINK_FILE_MISSING_ID: 'No link file found with ID',
  NO_LINK_FILES: 'No link files found',
  LINK_FILE_LOAD_ERROR: 'Error loading config',

  // Security errors
  PATH_OUTSIDE_REPO: 'Security: Path points outside repository',
  SECURITY_REFUSING_READ: 'Security: Refusing to read file outside repository',

  // Validation errors
  VALIDATION_FAILED: 'Validation failed - please fix the errors above',
  CHECK_FAILED: 'Check failed',
  INVALID_FILE_PATH: 'Invalid file path',

  // File system errors
  FILE_NOT_FOUND: 'File not found',
  PATH_IS_DIRECTORY: 'Path is a directory, not a file',

  // ID/reference errors
  CANNOT_USE_ID_WITHOUT_ROOT: 'Cannot use --id without a root configuration',
  DUPLICATE_PATH: 'Skipping duplicate link file path',
} as const;

/**
 * Standard success messages used throughout the application
 */
export const SUCCESS_MESSAGES = {
  // Validation success
  ROOT_CONFIG_VALID: 'Root configuration is valid',
  ALL_CONFIGS_VALID: 'All configurations are valid',

  // Check success
  NO_CHANGES_DETECTED: 'No changes detected',
  NO_TARGETS_NEED_ATTENTION: 'No target files need attention',

  // Init success
  ROOT_CONFIG_CREATED: 'Created root configuration',
  LINK_FILE_CREATED: 'Created link file',
} as const;

/**
 * Standard warning messages used throughout the application
 */
export const WARNING_MESSAGES = {
  // Configuration warnings
  ROOT_CONFIG_HAS_ERRORS: 'Root configuration has validation errors',
  ROOT_CONFIG_HAS_WARNINGS: 'Root configuration has warnings',
  LINK_FILE_HAS_ERRORS: 'Link file has validation errors',
  LINK_FILE_HAS_WARNINGS: 'Link file has warnings',

  // File warnings
  LINK_FILE_NOT_FOUND_WARNING: 'Link file not found',

  // Duplicate warnings
  DUPLICATE_PATH_WARNING: 'Skipping duplicate link file path',
  DUPLICATE_ALREADY_VALIDATED: 'Skipping: Duplicate path (already validated above)',

  // General warnings
  SKIPPING_INVALID_ENTRIES: 'Skipping invalid entries',
  SKIPPING_INVALID_LINKS: 'Skipping invalid links in this file',
} as const;

/**
 * Standard informational messages used throughout the application
 */
export const INFO_MESSAGES = {
  // Git repository info
  GIT_REPO_ROOT_LOCATION: 'Git repository root',
  CURRENT_DIRECTORY: 'Current directory',
  RUN_FROM_REPO_ROOT: 'Please run this command from the repository root.',

  // Instructions
  CREATE_LINK_IN_SUBDIR: 'To create a link file in a subdirectory, use',
  USE_FORCE_TO_OVERWRITE: 'Use --force to overwrite.',
  AVAILABLE_IDS: 'Available IDs',

  // Next steps
  NEXT_STEPS: 'Next steps',

  // Scanning
  SCANNING_FOR_LINK_FILES: 'Scanning for link files',
} as const;

/**
 * Helper type to get all message values
 */
export type ErrorMessage = (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES];
export type SuccessMessage = (typeof SUCCESS_MESSAGES)[keyof typeof SUCCESS_MESSAGES];
export type WarningMessage = (typeof WARNING_MESSAGES)[keyof typeof WARNING_MESSAGES];
export type InfoMessage = (typeof INFO_MESSAGES)[keyof typeof INFO_MESSAGES];
