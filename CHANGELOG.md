# Changelog

## [0.1.0] - 2025-10-25

### Added

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

- `filelinks list` - List all configured links
- `filelinks add` - Add new link to existing file
- `filelinks remove` - Remove link from file
