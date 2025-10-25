# filelinks Configuration Examples

This directory contains example configuration files to help you get started with filelinks.

## Table of Contents

- [Understanding the Configuration System](#understanding-the-configuration-system)
- [Example Link File](#example-link-file)
- [Common Use Cases](#common-use-cases)
  - [Documentation and Changelog](#1-documentation-and-changelog)
  - [API Documentation Sync](#2-api-documentation-sync)
  - [Database Schema Migrations](#3-database-schema-migrations)
  - [Package Dependencies](#4-package-dependencies)
- [Advanced Examples](#advanced-examples)
  - [Multi-Module Project](#multi-module-project)
  - [Monorepo Setup](#monorepo-setup)
  - [Pre-commit Validation](#pre-commit-validation)
- [Configuration Reference](#configuration-reference)
- [Getting Started: Usage Examples](#getting-started-usage-examples)

## Understanding the Configuration System

filelinks uses a **two-tier configuration system**:

1. **Link Files** (`filelinks.links.json`) - Define individual file links in any directory
2. **Root Configuration** (`filelinks.config.ts`) - References all link files in your repository

### Quick Setup

```bash
# At repository root: Create root config (TypeScript)
cd /path/to/repo
filelinks init

# In any directory: Create link file (JSON)
filelinks new

# Or use this example
cp examples/filelinks.links.json ./
filelinks validate
```

## Example Link File

The [filelinks.links.json](./filelinks.links.json) file in this directory demonstrates common use cases. Each link configuration declares a relationship between watched files and target files that should be reviewed when watches change.

**File structure:**

```json
[
  {
    "id": "unique-identifier",
    "name": "Human-Readable Name",
    "description": "What this link ensures",
    "watch": ["files/to/watch/**/*.ts"],
    "target": ["files/to/review/**/*.md"],
    "watchType": "uncommitted"
  }
]
```

**Important:** All file paths in link files are **relative to the git repository root**, not the directory containing the link file.

### Supported Link File Names

filelinks supports three different link file name formats. You can use any of these names interchangeably:

```bash
# Option 1: Default format (recommended)
filelinks.links.json

# Option 2: Dotfile with extension
.filelinksrc.json

# Option 3: Dotfile without extension
.filelinksrc
```

All three formats contain the same JSON structure and work identically. Choose based on your project conventions:

- Use `filelinks.links.json` for visibility and clarity
- Use `.filelinksrc.json` or `.filelinksrc` to keep your directory clean with dotfiles

**Example:**

```bash
# These all work the same way
filelinks validate ./filelinks.links.json
filelinks validate ./.filelinksrc.json
filelinks validate ./.filelinksrc
```

### Path Resolution in Subdirectories

When creating a link file in a subdirectory, remember that **all paths are relative to the git repository root**, not the current directory.

**Example project structure:**

```text
my-project/                    # ← Git repository root
├── README.md
├── docs/
│   └── API.md
└── src/
    └── api/
        ├── filelinks.links.json  # ← Link file in subdirectory
        └── routes.ts
```

**Correct path specification in `src/api/filelinks.links.json`:**

```json
[
  {
    "name": "API Routes Documentation",
    "watch": ["src/api/routes.ts"], // ← From repo root, not from src/api/
    "target": ["docs/API.md"], // ← From repo root
    "watchType": "uncommitted"
  }
]
```

**❌ Common mistake:**

```json
[
  {
    "name": "API Routes Documentation",
    "watch": ["routes.ts"], // ❌ Wrong: relative to link file
    "target": ["../../docs/API.md"], // ❌ Wrong: using ../
    "watchType": "uncommitted"
  }
]
```

**Why paths are from repository root:**

- Ensures consistency across all link files
- Makes paths portable (link files can be moved without breaking)
- Simplifies glob patterns for multi-directory searches
- Works seamlessly with the root configuration system

## Common Use Cases

### 1. Documentation and Changelog

Ensures the CHANGELOG is updated when documentation changes:

```json
{
  "id": "docs-changelog",
  "name": "Documentation and Changelog",
  "description": "Ensure CHANGELOG is updated when documentation changes",
  "watch": ["docs/**/*.md", "README.md"],
  "target": ["CHANGELOG.md"],
  "watchType": "uncommitted"
}
```

**When to use:**

- You want to remind contributors to update the changelog
- Documentation changes should be logged
- Any uncommitted changes to docs should trigger a reminder

**Command to check:**

```bash
filelinks check
```

**Output when docs change:**

```bash
⚠ Documentation and Changelog
  Ensure CHANGELOG is updated when documentation changes

  Changed files (uncommitted):
    • README.md

  Please review these target files:
    • CHANGELOG.md
```

### 2. API Documentation Sync

Keeps API documentation in sync with implementation:

```json
{
  "id": "api-docs",
  "name": "API Documentation",
  "description": "Keep API docs in sync with implementation",
  "watch": ["src/api/**/*.ts"],
  "target": ["docs/api/README.md", "docs/api/endpoints.md"],
  "watchType": "uncommitted"
}
```

**When to use:**

- API endpoints are defined in code
- Documentation must stay up-to-date with implementation
- You want to catch undocumented API changes

**Advanced usage with --id flag:**

```bash
# Check only API docs (requires root config)
filelinks check --id api-docs

# Verbose output with commit info
filelinks check --id api-docs --verbose
```

### 3. Database Schema Migrations

Ensures migrations are created when schema changes:

```json
{
  "id": "schema-migration",
  "name": "Database Schema and Migrations",
  "description": "Ensure migrations are created when schema changes",
  "watch": ["src/db/schema.ts"],
  "target": ["src/db/migrations/*.sql"],
  "watchType": "staged"
}
```

**When to use:**

- Schema definitions are in code (e.g., Drizzle, Prisma, TypeORM)
- Changes should be caught before commit
- You want pre-commit validation

**Why `watchType: "staged"`:**

- Only checks files that are staged (ready to commit)
- Perfect for pre-commit hooks
- Won't trigger on work-in-progress changes

**Pre-commit hook example:**

```bash
#!/usr/bin/env sh
# .husky/pre-commit

# Check staged schema changes
npx filelinks check --id schema-migration
```

### 4. Package Dependencies

Reminds to update lockfile when package.json changes:

```json
{
  "id": "package-lockfile",
  "name": "Package Dependencies",
  "description": "Remind to update lockfile when package.json changes",
  "watch": ["package.json"],
  "target": ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  "watchType": "unstaged"
}
```

**When to use:**

- You want to catch missing lockfile updates
- Multiple package managers are used in the project
- Changes to package.json should always regenerate lockfiles

**Why `watchType: "unstaged"`:**

- Detects changes to package.json that aren't staged yet
- Reminds developers to run `npm install` before staging
- Ensures lockfiles are included in the same commit

## Advanced Examples

### Multi-Module Project

For projects with multiple modules, create link files in each module:

**Project structure:**

```text
my-project/
├── filelinks.config.ts          # Root config
├── filelinks.links.json          # Root-level links
├── packages/
│   ├── api/
│   │   └── filelinks.links.json  # API module links
│   └── web/
│       └── filelinks.links.json  # Web module links
```

**Root configuration (filelinks.config.ts):**

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
      id: 'api',
      name: 'API Module',
      path: './packages/api/filelinks.links.json',
    },
    {
      id: 'web',
      name: 'Web Module',
      path: './packages/web/filelinks.links.json',
    },
  ],
};

export default config;
```

**Creating the setup:**

```bash
# At repository root
filelinks init

# In each module
cd packages/api
filelinks new  # Automatically added to root config

cd ../web
filelinks new  # Automatically added to root config
```

**Checking specific modules:**

```bash
# Check all modules
filelinks check

# Check only API module
filelinks check --id api

# Check specific file
filelinks check ./packages/api/filelinks.links.json
```

### Monorepo Setup

Example configuration for a monorepo with shared documentation:

**packages/api/filelinks.links.json:**

```json
[
  {
    "id": "api-types-docs",
    "name": "API Types Documentation",
    "description": "Keep type definitions in sync with API docs",
    "watch": ["packages/api/src/types/**/*.ts"],
    "target": ["docs/api/types.md"],
    "watchType": "uncommitted"
  },
  {
    "id": "api-tests",
    "name": "API Test Coverage",
    "description": "Remind to update tests when API changes",
    "watch": ["packages/api/src/**/*.ts"],
    "target": ["packages/api/tests/**/*.test.ts"],
    "watchType": "uncommitted"
  }
]
```

**packages/web/filelinks.links.json:**

```json
[
  {
    "id": "component-stories",
    "name": "Component Storybook Stories",
    "description": "Ensure Storybook stories exist for new components",
    "watch": ["packages/web/src/components/**/*.tsx"],
    "target": ["packages/web/src/components/**/*.stories.tsx"],
    "watchType": "uncommitted"
  }
]
```

**Benefits:**

- Each package maintains its own links
- Central root config references all packages
- Can check entire monorepo or specific packages
- Team members can add links without conflicts

### Pre-commit Validation

Use different `watchType` values for various commit stages:

```json
[
  {
    "id": "work-in-progress",
    "name": "WIP Documentation",
    "description": "General reminder during development",
    "watch": ["src/**/*.ts"],
    "target": ["docs/**/*.md"],
    "watchType": "uncommitted"
  },
  {
    "id": "pre-stage",
    "name": "Pre-Stage Validation",
    "description": "Check before staging files",
    "watch": ["src/config/**/*.ts"],
    "target": ["config/schema.json"],
    "watchType": "unstaged"
  },
  {
    "id": "pre-commit",
    "name": "Pre-Commit Validation",
    "description": "Final check before commit",
    "watch": ["src/db/schema.ts"],
    "target": ["src/db/migrations/*.sql"],
    "watchType": "staged"
  }
]
```

**Git workflow:**

```bash
# 1. During development (shows WIP reminders)
filelinks check
# Triggers: "work-in-progress" link if src files changed

# 2. Before staging (pre-stage validation)
filelinks check --id pre-stage
# Triggers: "pre-stage" link if config files have unstaged changes

# 3. Before commit (in pre-commit hook)
filelinks check --id pre-commit
# Triggers: "pre-commit" link if schema has staged changes
```

## Configuration Reference

### Link Configuration Fields

- **id** (optional): Unique identifier for the link
  - Used for filtering with `--id` flag
  - Must be unique within the link file
  - Example: `"api-docs"`, `"schema-migration"`

- **name** (optional): Human-readable name
  - Displayed in check output
  - Example: `"API Documentation Sync"`

- **description** (optional): Explains what this link ensures
  - Shown when the link triggers
  - Example: `"Keep API docs in sync with implementation"`

- **watch** (required): Array of file patterns to watch
  - Supports glob patterns (`**/*.ts`, `src/**/*.{ts,tsx}`)
  - Paths relative to git repository root
  - Example: `["src/api/**/*.ts", "src/types/**/*.ts"]`

- **target** (required): Array of files to review when watch files change
  - Supports glob patterns
  - Paths relative to git repository root
  - Example: `["docs/api/**/*.md", "README.md"]`

- **watchType** (optional): Type of changes to detect
  - `"uncommitted"` (default): Any changes not yet committed
  - `"unstaged"`: Changes not yet staged (modified but not added)
  - `"staged"`: Changes staged but not committed (added but not committed)

### Watch Type Comparison

| Watch Type    | Git Status                    | Use Case                      |
| ------------- | ----------------------------- | ----------------------------- |
| `uncommitted` | Modified, staged, or unstaged | General development reminders |
| `unstaged`    | Modified but not staged       | Pre-staging validation        |
| `staged`      | Staged but not committed      | Pre-commit hooks              |

### Glob Pattern Examples

```json
{
  "watch": [
    "**/*.ts", // All TypeScript files
    "src/**/*.{ts,tsx}", // TS and TSX in src/
    "src/api/v1/**/*.ts", // Only v1 API files
    "*.md", // Root-level markdown files
    "docs/**/*.md" // All markdown in docs/
  ]
}
```

### Glob Pattern Validation Behavior

filelinks handles glob patterns differently during validation:

**Glob patterns** (containing `*`, `**`, or `?`):

- ✅ Skip file existence checks
- Allow dynamic file matching
- Perfect for growing codebases

**Literal paths** (no wildcards):

- ✅ Checked for file existence
- Must exist during validation
- Will show warnings if missing

**Example:**

```json
[
  {
    "name": "API Documentation",
    "watch": [
      "src/api/**/*.ts", // ✅ Glob - not checked for existence
      "src/api/index.ts" // ✅ Literal - must exist
    ],
    "target": [
      "docs/api/**/*.md", // ✅ Glob - not checked for existence
      "docs/API.md" // ✅ Literal - must exist
    ],
    "watchType": "uncommitted"
  }
]
```

**Validation output:**

```bash
$ filelinks validate

Link file validation:
  ✓ All watch patterns are valid
  ✓ All target patterns are valid
  ✓ Literal path "src/api/index.ts" exists
  ✓ Literal path "docs/API.md" exists
  ✓ Glob patterns "src/api/**/*.ts" and "docs/api/**/*.md" will be matched at runtime
```

## Getting Started: Usage Examples

### Option 1: Use This Example

```bash
# Copy the example to your project root
cp examples/filelinks.links.json ./

# Customize for your needs
# Edit filelinks.links.json

# Validate configuration
filelinks validate

# Check for changes
filelinks check
```

### Option 2: Interactive Setup

```bash
# Create with interactive prompts
filelinks new

# Follow the prompts to define your links
```

### Option 3: Two-Tier Setup

```bash
# 1. Create root configuration
cd /path/to/repo
filelinks init

# 2. Create link files in subdirectories
cd src/api
filelinks new --empty

# 3. Edit link files manually
# Edit src/api/filelinks.links.json

# 4. Validate all configurations
cd /path/to/repo
filelinks validate

# 5. Check by ID
filelinks check --id api
```

## Validation

Always validate your configuration after changes:

```bash
# Validate all configurations
filelinks validate

# Validate only root config
filelinks validate --root

# Validate specific link file
filelinks validate ./filelinks.links.json
```

**Common validation errors:**

- Missing required fields (`watch`, `target`)
- Empty arrays for `watch` or `target`
- Invalid `watchType` values
- Duplicate IDs
- Files pointing outside repository (security check)
- Directory paths instead of file paths

## Tips

1. **Start simple**: Begin with one or two critical links, then expand
2. **Use descriptive IDs**: Make it easy to check specific links with `--id`
3. **Add descriptions**: Help team members understand why links exist
4. **Test with --verbose**: See commit information for changed files
5. **Combine with CI/CD**: Automate checks in your pipeline
6. **Use appropriate watchType**: Match your workflow (uncommitted/unstaged/staged)
7. **Organize by module**: Create separate link files for different parts of your project
8. **Document patterns**: Add comments in your link files explaining glob patterns

## More Information

For complete documentation, see the [main README](../README.md).
