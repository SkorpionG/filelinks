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

## Installation

Install `filelinks` as a dev dependency in your project:

```bash
npm install --save-dev filelinks
```

Or install globally to use across multiple projects:

```bash
npm install -g filelinks
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

**When run in a git repository with a root config, the new link file is automatically added to the root configuration.**

**Options:**

- `-e, --empty` - Create an empty link file
- `-f, --force` - Overwrite existing link file

**Examples:**

```bash
# Interactive setup with prompts
filelinks new

# Create empty link file
filelinks new --empty

# In a subdirectory
cd src/api
filelinks new

# Overwrite existing link file
filelinks new --force
```

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
- Required fields (watch, target) are present and non-empty
- Valid watchType values (uncommitted, unstaged, staged)
- No duplicate IDs within links
- Watch files exist and are files (not directories)
- Target files exist and are files (not directories)
- Paths don't point outside repository (security check)

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
- **watch** (required): Array of file patterns to watch for changes
- **target** (required): Array of files that should be updated when watch files change
- **watchType** (optional): Type of changes to detect (default: `uncommitted`)

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

- `**/*.ts` - All TypeScript files recursively
- `src/**/*.{ts,tsx}` - TypeScript and TSX files in src
- `*.md` - All markdown files in the same directory
- `docs/*.md` - All markdown files in docs directory

**Path resolution:** All paths should be relative to the git repository root.

**Validation behavior:**

- **Glob patterns** (containing `*`, `**`, or `?`) skip file existence checks during validation
- **Literal paths** (no wildcards) are checked to ensure files exist
- This allows you to use dynamic patterns without validation warnings

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

## License

MIT © [SkorpionG](https://github.com/SkorpionG)

## Repository

[https://github.com/SkorpionG/filelinks](https://github.com/SkorpionG/filelinks)
