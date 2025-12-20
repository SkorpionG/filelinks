# Changelog

## [0.3.4] - 2025-12-19

### Added

- **`filelinks orphans` command**: Find orphaned link files not referenced anywhere
  - Discovers link files that exist but aren't referenced by `filelinks.config.ts` or any `extends` field
  - Helps identify unused or forgotten link files that can be cleaned up
  - Shows which files are referenced by root config vs. extends
  - Groups orphaned files by directory for easy navigation
  - `-v, --verbose` flag shows detailed information about why each file is orphaned
  - Provides actionable suggestions for resolving orphaned files:
    - Add them to root config via `filelinks init`
    - Reference them via `extends` in another link file
    - Delete them if no longer needed
  - Works from any directory within the repository
  - Comprehensive test coverage with 16 unit tests

## [0.3.3] - 2025-12-19

### Added

- **Enhanced glob pattern validation**: Glob patterns in `watch` and `target` fields now validate that at least one file matches
  - If a glob pattern (containing `*`, `**`, or `?`) matches no files, a **warning** is displayed during validation
  - Helps catch typos and ensures patterns are configured correctly
  - Example: `docs/**/*.md` with no markdown files → `"Target pattern does not match any files: docs/**/*.md"`
  - Applies to both watch and target patterns
  - Previously, glob patterns were silently ignored during validation

- **Expanded glob pattern display in check command**: Target glob patterns are now expanded to show all matching files
  - When a target uses a glob pattern, `filelinks check` now shows all files that match
  - Each matched file is displayed with its existence status (✓ or ✗)
  - Pattern shown as a header with matched files indented below
  - If no files match, shows `(pattern matches 0 files)` warning
  - Makes it clear exactly which files need review when changes are detected

## [0.3.2] - 2025-11-03

### Added

- **`--skip-root` flag for `filelinks new` command**: Control whether new link files are added to root configuration
  - `-s, --skip-root` flag skips adding to root config entirely
  - Without the flag, users are prompted: "Add this link file to the root configuration?" (defaults to yes)
  - Provides flexibility for temporary or experimental link files
  - Useful when you want to create a link file without modifying the root config

### Fixed

- **Root config parsing with comments**: Fixed bug where comments containing braces in `filelinks.config.ts` would break link structure
  - Comments with `{ }` characters were incorrectly parsed as empty link entries
  - Added comment removal before parsing to prevent interference
  - Improved regex to only match objects with actual properties (id, name, or path)
  - Ensures robust parsing even with extensive code comments

## [0.3.1] - 2025-10-30

### Fixed

- **Duplicate link file loading**: Fixed issue where the same link file was loaded and processed twice when it appeared both in the root config AND in an "extends" property
  - Files loaded via extends are now tracked in the same deduplication system as root config files
  - Prevents wasteful duplicate I/O operations
  - Shows clear warning: "Link file X in extends was already loaded from root config. Skipping to avoid duplication."
  - Applies to both `check` and `validate` commands

- **Duplicate extends validation messages**: Fixed confusing error messages when multiple links had the same "extends" property
  - Previously showed "duplicate id, watch, target" errors after extends resolution
  - Now detects duplicate extends paths before resolution
  - Shows clear message: "Duplicate extends: links[N] extends 'path' which was already extended by links[M]. Skipping duplicate."
  - Prevents loading the same extended file multiple times within a single link file

- **Pattern matching with special characters**: Fixed bug where files in directories with parentheses or brackets weren't detected
  - Affects Next.js projects with route groups like `(dashboard)` and dynamic routes like `[id]`
  - Added proper escaping of regex special characters: `( ) [ ] { } + ^ $ | \`
  - Pattern matching now works correctly with all special characters in file paths
  - Added comprehensive test coverage for special characters in paths

### Changed

- **Init command messaging**: Improved clarity of messages when no link files exist
  - Changed "Scanning for link files" to "Searching for existing link files"
  - Changed warning to informative message: "No existing link files found - creating empty configuration"
  - Removed suggestion to use `filelinks new` when init is creating root config

## [0.3.0] - 2025-10-26

### Added - Extends Feature for Link Configuration Reuse

- **`extends` property**: Reuse link configurations from other link files
  - Reference another link file to include all its links
  - Syntax: `"extends": "path/to/filelinks.links.json"`
  - All links from the extended file are included
  - Circular reference detection prevents infinite loops
  - File name validation ensures only valid link files can be extended

- **Display properties with extends**: Use `name` and `description` for better organization
  - `name` and `description` can be used with `extends` for labeling
  - Helps identify what the extended configuration represents
  - Other properties (`watch`, `target`, `watchType`) are ignored when `extends` is set
  - Warnings shown if ignored properties are provided

- **Enhanced validation messaging**: Better feedback during validation
  - Shows which extended files were validated successfully
  - Displays link count from each extended file
  - Clear warnings when properties will be ignored due to `extends`
  - File path context in all error and warning messages

- **Improved error reporting**: File paths shown for all validation issues
  - Easy to identify which file has validation issues
  - Consistent format across `check` and `validate` commands

### Changed

- Link configurations now support optional `watch` and `target` properties (required only when `extends` is not set)
- Validation messages now display file paths for better context
- Link counting excludes invalid extends to show accurate totals

## [0.2.0] - 2025-10-25

### Added - New Features in `filelinks list` Command

- **`filelinks list` command**: Discover and navigate link files across your project
  - **Default mode**: Lists all link files recursively from current directory (changed behavior)
    - Previously listed all files in repository; now starts from current directory
    - More intuitive behavior: focuses on your current working context
  - **`--local` flag**: Lists link files only in current directory (non-recursive)
    - Works from anywhere in the repository
    - Shows only files in the exact directory you're in
  - **`--config` flag**: Lists link files from root configuration with IDs and names
    - Shows all files defined in `filelinks.config.ts`
    - Displays missing files with yellow `[MISSING]` tag
  - **`--config --local` combination**: Filter config files to current directory
    - NEW: Combines `--config` and `--local` to show only config files in current directory and subdirectories
    - Perfect for working in a specific module or package
    - Shows "X out of Y in config" to indicate filtering
  - **`-v, --verbose` flag**: Shows file sizes and link counts for all modes
    - Displays human-readable file sizes (B, KB, MB, GB, TB, PB)
    - Counts and displays the number of links in each link file
    - Format: `(2.25 KB, 3 links)` or `(1.04 KB, 1 link)`
    - Works with all combinations: default, `--local`, `--config`, and `--config --local`
  - Colored output for better readability
  - Directory grouping for organized output
  - Helpful hints suggesting other list modes

### Changed

- Improved UI consistency across all commands:
  - Removed extra indentation from command headers
  - More vibrant and scannable output

## [0.1.0] - 2025-10-25

### Added - Initial Release

- **Two-tier configuration system**: Link files (JSON) + Root configuration (TypeScript)
- **`filelinks init` command**: Initialize root configuration at git repository root
  - Creates TypeScript configuration file (`filelinks.config.ts`)
  - Automatically scans repository for existing link files
  - Ignores: `node_modules/`, `dist/`, `build/`, `.git/`, `coverage/`
  - Auto-generates IDs and names based on directory structure
  - Auto-resolves ID conflicts with numeric suffixes
- **`filelinks new` command**: Create link files in any directory
  - Interactive mode with prompts for adding links
  - `--empty` flag for creating empty link file
  - `--force` flag for overwriting existing files
  - Automatically adds new link files to root configuration
  - Supports multiple link file name formats
- **`filelinks check` command**: Check for changes in watched files
  - Detects git changes based on configurable watch types
  - `--id` flag to check specific link files by ID
  - `--verbose` flag for detailed commit information
  - Automatic link deduplication to prevent redundant warnings
  - Glob pattern support for dynamic file matching
- **`filelinks validate` command**: Comprehensive configuration validation
  - Validates root configuration and all link files
  - `--root` flag to validate only root configuration
  - Can be run from any subdirectory (searches upward)
  - Security checks for repository boundary violations
  - Distinguishes between errors and warnings
- **Multiple link file name formats**: `filelinks.links.json`, `.filelinksrc.json`, `.filelinksrc`
- **Git integration**: Full git repository awareness and change detection
- **Security features**: Repository boundary checks, path validation, duplicate detection
- **Comprehensive testing**: 125 passing tests with full coverage
- **Complete documentation**: README, examples, and inline JSDoc comments

### Configuration Features

**Link Files:**

- Three supported file name formats: `filelinks.links.json`, `.filelinksrc.json`, `.filelinksrc`
- Can be created in any directory within the repository
- All paths relative to git repository root (not link file location)
- JSON format with array of link configurations

**Root Configuration:**

- TypeScript format (`filelinks.config.ts`)
- Must be at git repository root
- Auto-generated IDs: `"root"` for root level, `"src-api"` for subdirectories
- Auto-generated names: `"Root Links"`, `"Src Api Links"` (capitalized)
- Automatic ID conflict resolution with numeric suffixes

**Watch Types:**

- `uncommitted` (default): Detects any changes not yet committed (staged + unstaged)
- `unstaged`: Detects only unstaged changes
- `staged`: Detects only staged changes (ready to commit)

**Validation:**

- Root configuration structure validation
- Required fields: `watch`, `target` (both must be non-empty arrays)
- Optional fields: `id`, `name`, `description`, `watchType`
- Duplicate ID detection
- Security: Repository boundary checks
- File existence checks for literal paths
- Glob patterns (`*`, `**`, `?`) skip existence checks

**Glob Pattern Support:**

- `**/*.ts` - All TypeScript files recursively
- `src/**/*.{ts,tsx}` - Multiple extensions with brace expansion
- `*.md` - Files in specific directory
- Full glob pattern matching for watch and target fields

### Coming Soon

- `filelinks add` - Add new link to existing file
- `filelinks remove` - Remove link from file
