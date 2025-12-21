# filelinks

[![npm version](https://img.shields.io/npm/v/filelinks.svg)](https://www.npmjs.com/package/filelinks)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

`filelinks` is a lightweight CLI tool for declaring implicit links between files in a workspace, notifying when watched files change. This is useful for ensuring related documentation or configuration files are updated when source files change.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [`filelinks init`](#filelinks-init-options)
  - [`filelinks new`](#filelinks-new-options)
  - [`filelinks list`](#filelinks-list-options)
  - [`filelinks orphans`](#filelinks-orphans-options)
  - [`filelinks check`](#filelinks-check-file-options)
  - [`filelinks validate`](#filelinks-validate-file-options)
- [Configuration](#configuration)
  - [Two-Tier Configuration System](#two-tier-configuration-system)
  - [Link Files](#link-files-filelinkslinksjson)
  - [Root Configuration](#root-configuration-filelinksconfigts)
  - [Configuration Fields](#configuration-fields)
  - [Watch Types](#watch-types)
- [Advanced Usage](#advanced-usage)
  - [Link Deduplication](#link-deduplication)
  - [Glob Patterns in Watch/Target](#glob-patterns-in-watchtarget)
  - [Security Features](#security-features)
- [Workflows](#workflows)
  - [Setting Up a New Repository](#setting-up-a-new-repository)
  - [Adding Links to a Subdirectory](#adding-links-to-a-subdirectory)
- [Example Use Cases](#example-use-cases)
- [Troubleshooting](#troubleshooting)
  - [Command Not Found After Installation](#command-not-found-after-installation)
  - [Installation Location Matters](#installation-location-matters)
  - [Verifying Installation](#verifying-installation)
- [Change Log](#change-log)

## Installation

Install `filelinks` as a dev dependency in your project:

```bash
npm install --save-dev filelinks
```

Or install globally to use across multiple projects:

```bash
npm install -g filelinks
```

### Using Yarn

Install as a dev dependency:

```bash
yarn add --dev filelinks
```

Or install globally:

```bash
yarn global add filelinks
```

### Using pnpm

Install as a dev dependency:

```bash
pnpm add -D filelinks
```

Or install globally:

```bash
pnpm add -g filelinks
```

## Quick Start

```bash
# At repository root: Create a root config that references all link files
cd /path/to/repo
filelinks init

# In any directory: Create a link file (JSON)
filelinks new

# Or create an empty link file
filelinks new --empty

# Validate your configuration
filelinks validate

# Check for changes in watched files
filelinks check
```

## Commands

### `filelinks init [options]`

Initialize a root-level configuration at the git repository root. This creates a **TypeScript config file** (`filelinks.config.ts`) that references all link files in your repository.

**Must be run at git repository root.**

**Options:**

- `-f, --force` - Overwrite existing configuration

**Examples:**

```bash
# Create TypeScript root config
cd /path/to/repo-root
filelinks init

# Force overwrite existing config
filelinks init --force
```

**What it does:**

- Scans the entire repository for existing link files
- Ignores: `node_modules/`, `dist/`, `build/`, `.git/`, `coverage/`
- Auto-generates IDs and names for each link file found
- Creates a TypeScript configuration file

**What it creates:**

```typescript
import { RootConfig } from 'filelinks';

const config: RootConfig = {
  linkFiles: [
    // Link files will be added here
  ],
};

export default config;
```

### `filelinks new [options]`

Create a new link file (`filelinks.links.json`). Can be used in any directory, including subdirectories within a git repository. This allows multiple link files in different parts of your project to avoid one large config file.

**When run in a git repository with a root config, you'll be prompted whether to add the new link file to the root configuration** (unless you use the `--skip-root` flag).

**Options:**

- `-e, --empty` - Create an empty link file
- `-f, --force` - Overwrite existing link file
- `-s, --skip-root` - Skip adding to root configuration

**Examples:**

```bash
# Interactive setup with prompts
filelinks new

# Create empty link file (will prompt to add to root config)
filelinks new --empty

# Skip adding to root config
filelinks new --skip-root

# Create empty file without adding to root config
filelinks new --empty --skip-root

# In a subdirectory
cd src/api
filelinks new

# Overwrite existing link file
filelinks new --force
```

### `filelinks list [options]`

List link files in the current directory and subdirectories. Helps you discover and navigate link files across your project.

**Options:**

- `--local` - List only link files in the current directory (non-recursive)
- `--config` - List link files from root configuration (shows IDs, names, and paths)
  - Can be combined with `--local` to filter config files to current directory and subdirectories
- `-v, --verbose` - Show file sizes, link counts, and additional details

**Examples:**

```bash
# List link files recursively from current directory (default)
filelinks list

# List only in current directory (non-recursive)
filelinks list --local

# List from root config with IDs
filelinks list --config

# List config files that are in current directory and subdirectories
filelinks list --config --local

# Show file sizes and link counts with verbose mode
filelinks list --verbose
filelinks list --local -v
filelinks list --config --verbose
filelinks list --config --local --verbose
```

**Output modes:**

**Default mode** (`filelinks list`):
Lists all link files recursively from the current directory

```bash
✓ Found 5 link file(s):

(current directory)/
  • filelinks.links.json - filelinks.links.json

cli_test/
  • filelinks.links.json - cli_test/filelinks.links.json

examples/
  • filelinks.links.json - examples/filelinks.links.json

Total: 5 link file(s)

Run "filelinks list --local" to see only files in current directory (non-recursive)
Run "filelinks list --config" to see files from filelinks.config.ts
Run "filelinks list --verbose" to see file sizes and link counts
```

**Local mode** (`filelinks list --local`):
Lists only files in current directory (non-recursive)

```bash
Link files in current directory:

✓ Found 1 link file(s):

  • filelinks.links.json

Run "filelinks list --local --verbose" to see file sizes and link counts
```

**Verbose mode** (`filelinks list --verbose`):
Shows file sizes and link counts

```bash
✓ Found 1 link file(s):

(current directory)/
  • filelinks.links.json - filelinks.links.json (1.04 KB, 4 links)

Total: 1 link file(s)
```

**Config mode** (`filelinks list --config`):
Lists files from root configuration

```bash
Link files from filelinks.config.ts:

✓ Found 3 link file(s) in config:

  • root - Root Links (./filelinks.links.json)
  • api - API Module (./packages/api/filelinks.links.json)
  • web - Web Module (./packages/web/filelinks.links.json)

Run "filelinks list --config --verbose" to see file sizes and link counts
```

**Config + Local mode** (`filelinks list --config --local`):
Filters config files to current directory and subdirectories

```bash
Link files from filelinks.config.ts:

✓ Found 2 link file(s) in current directory (out of 10 in config):

  • api - API Module (./packages/api/filelinks.links.json)
  • api-v2 - API V2 Module (./packages/api/v2/filelinks.links.json)

Run "filelinks list --config --local --verbose" to see file sizes and link counts
```

**Features:**

- Colored output for better readability:
  - **Cyan** for counts and IDs
  - **Green** for filenames
  - **Dim** for file paths
  - **Yellow** for missing files (in `--config` mode)
- Grouped by directory in default and recursive modes
- File sizes shown only with `--verbose` flag (formatted: B, KB, MB, GB, TB)
- Detects missing files in `--config` mode
- Works from any directory in the repository

### `filelinks orphans [options]`

Find orphaned link files that exist but aren't referenced by the root configuration or any `extends` field. This helps identify unused or forgotten link files that can be cleaned up.

A link file is considered **orphaned** if:

- It exists in the repository
- It's NOT referenced in `filelinks.config.ts`
- It's NOT referenced by any other link file's `extends` field

**Options:**

- `-v, --verbose` - Show verbose output with reference details

**Examples:**

```bash
# Find orphaned link files
filelinks orphans

# Show detailed information about why files are orphaned
filelinks orphans --verbose
```

**Output:**

When orphaned files are found:

```bash
 Find orphaned filelinks link files

Scanning for link files...

Found 10 total link file(s)

Finding referenced link files...

2 referenced by filelinks.config.ts
1 referenced by extends fields

⚠ Found 3 orphaned link file(s):

test/
  • filelinks.links.json - test/filelinks.links.json

lib/
  • filelinks.links.json - lib/filelinks.links.json

docs/archive/
  • filelinks.links.json - docs/archive/filelinks.links.json

Total: 3 orphaned file(s)

These files exist but are not referenced by:
  • filelinks.config.ts (root configuration)
  • Any other link file's "extends" field

Suggestions:
  • Add them to root config: filelinks init (or edit filelinks.config.ts)
  • Reference them via "extends" in another link file
  • Delete them if they're no longer needed

Run "filelinks orphans --verbose" for more details
```

**With verbose flag:**

Shows additional context about why each file is orphaned:

```bash
test/
  • filelinks.links.json - test/filelinks.links.json (not in config, no extends refs)
```

When no orphaned files exist:

```bash
✓ No orphaned link files found! All link files are referenced.

All 10 link file(s) are either in the root config or referenced via extends.
```

**Features:**

- Scans entire repository for link files (respects ignore patterns)
- Checks both root config and extends references
- Groups orphaned files by directory for easy navigation
- Provides actionable suggestions for resolution
- Works from any directory within the repository
- Helpful for maintaining clean configuration

**Use cases:**

- **Repository cleanup**: Find and remove unused link files
- **Migration verification**: Ensure all files are properly referenced after restructuring
- **Audit**: Verify that all link files are intentionally configured
- **Troubleshooting**: Identify why certain link files aren't being processed

### `filelinks check [file] [options]`

Check for changes in watched files and notify about targets that may need updates.

**Arguments:**

- `[file]` - Optional path to a specific link file to check (e.g., `./src/api/filelinks.links.json`)

**Options:**

- `--id <id>` - Check only specific link file by ID (requires root config)
- `-v, --verbose` - Show verbose output including:
  - Last commit hash (shortened to 7 characters)
  - Commit message
  - Author name
  - Commit date

**Examples:**

```bash
# Check all links
filelinks check

# Check only specific link file by ID
filelinks check --id root

# Verbose output with commit info
filelinks check --verbose

# Check a specific link file by path
filelinks check ./src/api/filelinks.links.json

# Combine options
filelinks check --id api-docs --verbose
```

**File path requirements:**

When checking a specific file by path, the file must:

- Exist and be a file (not a directory)
- Have a valid link file name: `filelinks.links.json`, `.filelinksrc.json`, or `.filelinksrc`
- Be within the git repository (paths outside are rejected for security)

**ID error handling:**

If you specify an ID that doesn't exist, all available IDs will be displayed:

```bash
$ filelinks check --id nonexistent

✗ No link file found with ID: nonexistent

Available IDs:
  • root - Root Links
  • api-docs - API Documentation Links
  • src-api - Src Api Links
```

**Output:**

```bash
⚠ README and Changelog Link
  Ensure CHANGELOG is updated when README changes

  Changed files (uncommitted):
    • README.md

  Please review these target files:
    • CHANGELOG.md
```

**With verbose flag:**

```bash
⚠ README and Changelog Link
  Ensure CHANGELOG is updated when README changes

  Changed files (uncommitted):
    • README.md
      Last commit: a1b2c3d - Update installation instructions (John Doe)

  Please review these target files:
    • CHANGELOG.md
```

### `filelinks validate [file] [options]`

Validate your root configuration and the link files it references for errors.

**Arguments:**

- `[file]` - Optional path to a specific link file to validate (e.g., `./filelinks.links.json`)

**Options:**

- `--root` - Validate only the root configuration (skip link files)
  - Quick syntax check of root config
  - Useful for debugging root config issues

**Running from subdirectories:**

You can run `filelinks validate` from any subdirectory within your repository. The command will automatically search upward to find link files and the root configuration.

**Examples:**

```bash
# Validate all configurations
filelinks validate

# Validate only root configuration
filelinks validate --root

# Validate a specific link file
filelinks validate ./src/api/filelinks.links.json

# Validate from a subdirectory
cd src/api
filelinks validate ./filelinks.links.json
```

**Validation checks:**

**Root configuration:**

- Valid structure (linkFiles array exists)
- No duplicate IDs in linkFiles
- No duplicate paths in linkFiles
- All paths end with valid link file names
- All referenced link files exist
- Paths don't point outside repository (security check)

**Link files:**

- Valid JSON structure (array of FileLinkConfig)
- Required fields (watch, target) are present and non-empty (unless extends is set)
- Valid watchType values (uncommitted, unstaged, staged)
- No duplicate IDs within links
- Watch files exist and are files (not directories)
- Target files exist and are files (not directories)
- Paths don't point outside repository (security check)
- Extended files exist and have valid link file names
- No circular references in extends chains
- Warnings shown when properties are ignored due to extends

**Examples:**

```bash
# Validate all configurations
filelinks validate

# Validate only root configuration
filelinks validate --root

# Validate a specific link file
filelinks validate ./src/api/filelinks.links.json
```

**Output:**

```bash
filelinks validate

Root Configuration:
  /path/to/repo/filelinks.config.ts

✓ Root configuration is valid

Link Files:

Root Links (root):
  ./filelinks.links.json

  ✓ Valid (2 link(s))

Summary:
  ✓ All configurations are valid
```

## Configuration

### Two-Tier Configuration System

filelinks uses a two-tier configuration system that allows you to organize links across your project:

1. **Link Files** (`filelinks.links.json`) - Define individual file links in any directory
2. **Root Configuration** (`filelinks.config.ts`) - References all link files in your repository

### Link Files (filelinks.links.json)

Create link files in different parts of your project:

```bash
# Root level
filelinks new

# API module
cd src/api
filelinks new

# Documentation
cd docs
filelinks new
```

**Supported link file names:**

filelinks supports three link file name formats. You can use any of these names:

- `filelinks.links.json` (default, recommended)
- `.filelinksrc.json` (dotfile format)
- `.filelinksrc` (dotfile without extension)

All three formats are fully supported and can be used interchangeably throughout your project.

Each link file contains an array of link configurations:

```json
[
  {
    "id": "unique-link-identifier",
    "name": "Link Name",
    "description": "Optional description",
    "watch": ["path/to/file1.ts", "path/to/file2.ts"],
    "target": ["docs/CHANGELOG.md", "README.md"],
    "watchType": "uncommitted"
  }
]
```

**Important:** All paths in link files should be **relative to the git repository root**, not the directory containing the link file.

### Root Configuration (filelinks.config.ts)

Create a TypeScript root configuration that references all link files:

```bash
cd /path/to/repo-root
filelinks init  # Creates filelinks.config.ts
```

This generates:

```typescript
import { RootConfig } from 'filelinks';

const config: RootConfig = {
  linkFiles: [
    {
      id: 'root',
      name: 'Root Links',
      path: './filelinks.links.json',
    },
    {
      id: 'src-api',
      name: 'Src Api Links',
      path: './src/api/filelinks.links.json',
    },
  ],
};

export default config;
```

**Auto-generated IDs and names:**

When link files are added to the root configuration (either via `filelinks init` or `filelinks new`), IDs and names are automatically generated based on the directory structure:

- Root level: `id: "root"`, `name: "Root Links"`
- Subdirectories: `id: "src-api"` (slashes become hyphens), `name: "Src Api Links"` (capitalized)

If an ID already exists, a suffix is added automatically: `src-api-2`, `src-api-3`, etc.

You can then run checks by link file ID:

```bash
filelinks check --id src-api  # Only check API links
```

### Configuration Fields

**Link File Reference (in root config):**

- **id** (required): Unique identifier for the link file
- **name** (required): Human-readable name
- **path** (required): Relative path from git root to the link file

**Link Configuration (in link files):**

- **id** (optional): Unique identifier for the link
- **name** (optional): Human-readable name
- **description** (optional): What this link ensures
- **watch** (required unless `extends` is set): Array of file patterns to watch for changes
- **target** (required unless `extends` is set): Array of files that should be updated when watch files change
- **watchType** (optional): Type of changes to detect (default: `uncommitted`)
- **extends** (optional): Path to another link file to include all its links

### Extending Link Configurations

The `extends` property allows you to reuse link configurations from other link files. This is useful for:

- Sharing common link configurations across multiple directories
- Creating a centralized set of links that can be reused
- Organizing complex link structures

**Example:**

```json
[
  {
    "id": "shared-docs",
    "name": "Shared Documentation Links",
    "description": "Includes all documentation links from shared config",
    "extends": "shared/filelinks.links.json"
  }
]
```

**How extends works:**

- When you use `extends`, ALL links from the referenced file are included
- You can use `name` and `description` with `extends` to label what the extended configuration represents
- Other properties (`watch`, `target`, `watchType`) are ignored when `extends` is set
- If you provide these ignored properties, a warning will be shown during validation
- Circular references (file extending itself) are automatically detected and prevented
- Extended files must have valid link file names (`filelinks.links.json`, `.filelinksrc.json`, or `.filelinksrc`)

**Example with ignored properties warning:**

```json
[
  {
    "id": "api-links",
    "name": "API Links",
    "extends": "shared/api.links.json",
    "watch": ["src/**/*.ts"], // ⚠️ Warning: ignored because extends is set
    "target": ["docs/API.md"] // ⚠️ Warning: ignored because extends is set
  }
]
```

### Watch Types

filelinks can detect different types of file changes based on git status:

- **`uncommitted`** (default): Detects any changes not yet committed (includes both staged and unstaged changes)
- **`unstaged`**: Detects only changes that are not yet staged
- **`staged`**: Detects only changes that are staged but not committed

If `watchType` is not specified, it defaults to `uncommitted`.

**Example:**

```json
[
  {
    "name": "Pre-commit Documentation Check",
    "watch": ["src/**/*.ts"],
    "target": ["docs/API.md"],
    "watchType": "staged"
  }
]
```

## Advanced Usage

### Link Deduplication

When checking for changes, filelinks automatically removes duplicate link configurations to prevent redundant notifications:

- Duplicate links are identified by their signature: `watchType + watch patterns + target patterns`
- If multiple links have identical watch/target/watchType combinations, only one check is performed
- This deduplication happens silently to improve performance

**Example:**

```json
[
  {
    "name": "Link 1",
    "watch": ["src/index.ts"],
    "target": ["README.md"],
    "watchType": "uncommitted"
  },
  {
    "name": "Link 2",
    "watch": ["src/index.ts"],
    "target": ["README.md"],
    "watchType": "uncommitted"
  }
]
```

In this case, only one warning will be shown even though two links are defined.

### Glob Patterns in Watch/Target

Both `watch` and `target` fields support glob patterns:

```json
[
  {
    "name": "API Documentation Sync",
    "watch": ["src/api/**/*.ts"],
    "target": ["docs/api/**/*.md"],
    "watchType": "uncommitted"
  }
]
```

**Supported patterns:**

- `**/*.ts` - All TypeScript files recursively (in current directory and all subdirectories)
- `src/**/*.{ts,tsx}` - TypeScript and TSX files in src and all subdirectories
- `*.md` - All markdown files in the root directory only
- `docs/*.md` - All markdown files in docs directory only (not in subdirectories)
- `docs/**/*.md` - All markdown files in docs directory and all subdirectories

**Important: `*` vs `**` difference:\*\*

- `*` matches files within a **single directory level** only
- `**` matches files **recursively** across all subdirectory levels

Example:

- `docs/*.md` matches `docs/README.md` but NOT `docs/guides/setup.md`
- `docs/**/*.md` matches both `docs/README.md` AND `docs/guides/setup.md`

**Next.js route support:**

Square brackets in paths (Next.js dynamic routes and route groups) are fully supported:

- `app/[id]/page.tsx` - Dynamic route segment
- `app/posts/[slug]/*.tsx` - Dynamic route with wildcards
- `app/[...params]/page.tsx` - Catch-all route
- `app/(auth)/login/*.tsx` - Route groups (parentheses)

**Path resolution:** All paths should be relative to the git repository root.

**Validation behavior:**

- **Glob patterns** (containing `*`, `**`, or `?`) are checked to ensure at least one file matches
  - If no files match the pattern, a **warning** is displayed during validation
  - Example: `docs/**/*.md` with no markdown files → warning shown
- **Literal paths** (no wildcards) are checked to ensure files exist
- This helps catch typos and ensures your patterns are working correctly

**Check command with glob patterns:**

When running `filelinks check`, target glob patterns are expanded to show all matching files:

```bash
⚠ Documentation and Changelog
  docs/README.md

  Changed files (uncommitted):
    • docs/README.md

  Please review these target files:
    docs/**/*.md:
      • docs/README.md ✓
      • docs/guide.md ✓
      • docs/api/endpoints.md ✓
```

If a glob pattern matches no files, it shows:

```bash
  Please review these target files:
    ✗ docs/**/*.md
      (pattern matches 0 files)
```

### Security Features

filelinks includes several security features to prevent malicious or accidental access outside your repository:

**Repository boundary checks:**

- All file paths are validated to be within the git repository
- Paths starting with `..` or absolute paths are rejected
- Symlinks pointing outside the repo are blocked

**File type validation:**

- Link file names must be one of: `filelinks.links.json`, `.filelinksrc.json`, or `.filelinksrc`
- Directories are detected and rejected with clear error messages

**Duplicate detection:**

- Duplicate link file paths in root config are detected and skipped
- Duplicate link IDs are reported as validation errors

**Example security error:**

```bash
$ filelinks check ../../outside-repo/filelinks.links.json

✗ Invalid file path

  • Path points outside the git repository
  • Repository root: /path/to/repo
  • Resolved path: /path/to/outside-repo/filelinks.links.json
```

## Workflows

### Setting Up a New Repository

```bash
# 1. Navigate to repository root
cd /path/to/repo

# 2. Initialize root configuration
filelinks init

# 3. Create your first link file
filelinks new

# 4. Follow interactive prompts to define links
# ID: readme-changelog
# Name: README and Changelog
# Description: Ensure changelog is updated when README changes
# Watch files: README.md
# Target files: CHANGELOG.md

# 5. Validate configuration
filelinks validate

# 6. Check for changes
filelinks check
```

### Adding Links to a Subdirectory

```bash
# 1. Navigate to subdirectory
cd src/api

# 2. Create link file (automatically added to root config)
filelinks new --empty

# 3. Edit the link file to add your links
# Edit: src/api/filelinks.links.json

# 4. Validate the new link file
filelinks validate ./filelinks.links.json

# 5. Check all links
cd /path/to/repo
filelinks check

# Or check just this link file by ID
filelinks check --id src-api
```

## Example Use Cases

See [examples/README.md](examples/README.md) for real-world configuration examples including:

- Documentation synchronization
- API and implementation consistency
- Configuration file relationships
- Test coverage tracking
- Multi-package monorepo links

## Troubleshooting

### Command Not Found After Installation

If you get a "command not found" error when running `filelinks`, this is typically due to how npm installs packages locally vs. globally.

**Problem:** When you install `filelinks` locally (e.g., `npm install --save-dev filelinks`), the executable is placed in `node_modules/.bin/`, which is not in your system's `$PATH`.

**Solutions:**

#### Option 1: Use npx (Recommended)

`npx` runs executables from local `node_modules/.bin/` without needing them in your `$PATH`:

```bash
npx filelinks init
npx filelinks check
npx filelinks validate
```

**Why this works:** `npx` automatically finds and runs the locally installed version of `filelinks`.

#### Option 2: Use npm scripts

Add `filelinks` commands to your `package.json` scripts. npm automatically adds `node_modules/.bin/` to the PATH when running scripts:

```json
{
  "scripts": {
    "links:check": "filelinks check",
    "links:validate": "filelinks validate",
    "links:init": "filelinks init"
  }
}
```

Then run:

```bash
npm run links:check
npm run links:validate
```

**Why this works:** When npm runs a script, it temporarily adds `node_modules/.bin/` to the PATH.

#### Option 3: Install globally

Install `filelinks` globally to make it available system-wide:

```bash
npm install -g filelinks
# Now you can use it directly
filelinks check
```

**Trade-offs:**

- ✅ Works from any directory without `npx`
- ❌ Not tied to project version (team members might have different versions)
- ❌ Requires admin/sudo on some systems

#### Option 4: Add to PATH manually (Advanced)

You can add your project's `node_modules/.bin/` to your PATH, but this is **not recommended** as it's project-specific:

```bash
# Temporarily for current shell session
export PATH="./node_modules/.bin:$PATH"

# Now you can run
filelinks check
```

**Why this isn't recommended:** This only works in the current directory and requires setting up for each shell session.

### Installation Location Matters

**Important:** For local installations, the command only works when:

1. You're in the directory where `filelinks` is installed, OR
2. You're in a subdirectory of that location, AND
3. You use `npx filelinks` or npm scripts

**Example:**

```bash
# ✅ Works - in the directory where filelinks is installed
/my-repo$ npm install --save-dev filelinks
/my-repo$ npx filelinks check

# ✅ Works - in a subdirectory
/my-repo/src$ npx filelinks check

# ❌ Doesn't work - parent directory doesn't have filelinks
/parent-dir$ npm install --save-dev filelinks
/parent-dir/my-repo$ filelinks check  # Command not found!
```

**Best practice:** Install `filelinks` at your repository root as a dev dependency, then use `npx` or npm scripts to run it from anywhere in your project.

### Verifying Installation

Check if `filelinks` is installed correctly:

```bash
# Check if installed locally
npx filelinks --version

# Check if installed globally
filelinks --version

# Check where it's installed
npm list filelinks
```

## Change Log

See [CHANGELOG.md](CHANGELOG.md) for a detailed list of changes and updates.

## License

This software is licensed under the MIT License © by [SkorpionG](https://github.com/SkorpionG)

## Repository

[https://github.com/SkorpionG/filelinks](https://github.com/SkorpionG/filelinks)
