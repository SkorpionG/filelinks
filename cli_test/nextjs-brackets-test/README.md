# Next.js Brackets Test

This directory contains integration tests for verifying that filelinks correctly handles Next.js dynamic routes with square brackets and catch-all routes.

## Test Structure

```
cli_test/nextjs-brackets-test/
├── app/
│   ├── posts/[id]/              # Dynamic route with [id]
│   │   └── page.tsx
│   ├── blog/[...slug]/          # Catch-all route with [...slug]
│   │   └── page.tsx
│   ├── [account]/_components/   # Dynamic route at root with _components
│   │   ├── AccountHeader.tsx
│   │   └── AccountNav.tsx
│   └── settings/[userId]/       # Nested dynamic route
│       └── page.tsx
├── components/shared/
│   └── Button.tsx
├── filelinks.links.json         # Test configuration
└── README.md
```

## What This Tests

### 1. Single Parameter Dynamic Routes

Tests patterns like `app/posts/[id]/*.tsx` to ensure:

- Square brackets are treated as literal characters, not glob character classes
- Files in `[id]` directory are correctly matched
- No false "does not match any files" warnings

### 2. Catch-all Routes

Tests patterns like `app/blog/[...slug]/*.tsx` to ensure:

- Multiple dots and brackets are handled correctly
- Catch-all route syntax doesn't break pattern matching

### 3. Root-level Dynamic Routes with Subdirectories

Tests patterns like `app/[account]/_components/*.tsx` to ensure:

- Dynamic routes at root level work
- Underscore-prefixed directories (Next.js convention for route groups) work
- Glob patterns match multiple files in bracket directories

### 4. Nested Dynamic Routes

Tests patterns like `app/settings/[userId]/*.tsx` to ensure:

- Dynamic segments in nested paths work correctly
- Path parsing handles brackets at any depth

### 5. Recursive Glob with Multiple Bracket Directories

Tests patterns like `app/**/*.tsx` to ensure:

- Recursive glob works across all bracket directories
- No directories are skipped due to bracket characters

## Running the Test

### Validate Configuration

```bash
# From repository root
npx filelinks validate cli_test/nextjs-brackets-test/filelinks.links.json
```

**Expected Result:** All links should validate successfully without warnings about "does not match any files"

### Check for Changes

```bash
# Make a change to any file in bracket directories
echo "// updated" >> cli_test/nextjs-brackets-test/app/posts/[id]/page.tsx

# Run check
npx filelinks check cli_test/nextjs-brackets-test/filelinks.links.json
```

**Expected Result:** Should detect the change and show target files that need review

### Test Glob Pattern Expansion

```bash
# Run check with verbose to see matched files
npx filelinks check cli_test/nextjs-brackets-test/filelinks.links.json --verbose
```

**Expected Result:** Target glob patterns should expand to show all matching files with ✓ or ✗ status

## Bugs This Test Addresses

### Bug 1: False "does not match any files" warnings (v0.3.3)

**Before Fix:** Patterns like `app/[account]/_components/*.tsx` would show warnings even when files exist
**After Fix:** Patterns correctly match files and no false warnings appear

### Bug 2: Orphans command false positives (v0.3.4)

**Before Fix:** Files in bracket directories were incorrectly marked as orphans when referenced in root config
**After Fix:** Root config parsing correctly handles paths with brackets, orphans command works correctly

## Manual Test Checklist

- [ ] Validation shows no errors or warnings
- [ ] All 5 link configurations validate successfully
- [ ] Glob patterns with `[id]` match files correctly
- [ ] Glob patterns with `[...slug]` match files correctly
- [ ] Glob patterns with `[account]` match multiple files
- [ ] Recursive glob `**/*.tsx` matches all bracket directories
- [ ] Check command detects changes in bracket directories
- [ ] Target files are displayed correctly in check output

## Expected Output

When running validation:

```
✓ Valid (5 link(s))
```

When running check after making changes:

```
⚠ Next.js Account Components
  Test glob pattern with [account] in path and _components directory

  Changed files (uncommitted):
    • cli_test/nextjs-brackets-test/app/[account]/_components/AccountHeader.tsx

  Please review these target files:
    cli_test/nextjs-brackets-test/components/shared/*.tsx:
      • cli_test/nextjs-brackets-test/components/shared/Button.tsx ✓
```

## Cleanup

This test directory is part of the cli_test suite and should be committed to the repository to ensure future changes don't break Next.js route support.
