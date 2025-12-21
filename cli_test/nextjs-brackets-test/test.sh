#!/bin/bash

# Integration test script for Next.js brackets support
# This script verifies that filelinks correctly handles Next.js dynamic routes

set -e

echo "========================================"
echo "Next.js Brackets Integration Test"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

cd "$REPO_ROOT"

echo "Test 1: Validate configuration"
echo "--------------------------------------"
if npx filelinks validate cli_test/nextjs-brackets-test/filelinks.links.json; then
    echo -e "${GREEN}✓ PASSED${NC} - Configuration validates without errors"
else
    echo -e "${YELLOW}✗ FAILED${NC} - Configuration validation failed"
    exit 1
fi
echo ""

echo "Test 2: Check glob patterns match files"
echo "--------------------------------------"
# Make a temporary change to test check command
echo "// Test update" >> "cli_test/nextjs-brackets-test/app/[account]/_components/AccountHeader.tsx"

if npx filelinks check cli_test/nextjs-brackets-test/filelinks.links.json > /tmp/filelinks-check-output.txt 2>&1; then
    if grep -q "Next.js Account Components" /tmp/filelinks-check-output.txt; then
        echo -e "${GREEN}✓ PASSED${NC} - Check command detects changes in bracket directories"
    else
        echo -e "${YELLOW}✗ FAILED${NC} - Check command did not detect changes"
        cat /tmp/filelinks-check-output.txt
        exit 1
    fi
else
    echo -e "${YELLOW}✗ FAILED${NC} - Check command failed"
    cat /tmp/filelinks-check-output.txt
    exit 1
fi

# Revert the change
git checkout -- "cli_test/nextjs-brackets-test/app/[account]/_components/AccountHeader.tsx" 2>/dev/null || true
echo ""

echo "Test 3: Verify all bracket patterns"
echo "--------------------------------------"
PATTERNS=(
    "app/posts/[id]/*.tsx"
    "app/blog/[...slug]/*.tsx"
    "app/[account]/_components/*.tsx"
    "app/settings/[userId]/*.tsx"
)

ALL_PASSED=true
for pattern in "${PATTERNS[@]}"; do
    if npx filelinks validate cli_test/nextjs-brackets-test/filelinks.links.json 2>&1 | grep -q "does not match any files.*$pattern"; then
        echo -e "${YELLOW}✗ FAILED${NC} - Pattern '$pattern' showing false warning"
        ALL_PASSED=false
    else
        echo -e "${GREEN}✓ PASSED${NC} - Pattern '$pattern' validates correctly"
    fi
done

if [ "$ALL_PASSED" = true ]; then
    echo ""
    echo "========================================"
    echo -e "${GREEN}All tests PASSED!${NC}"
    echo "========================================"
    exit 0
else
    echo ""
    echo "========================================"
    echo -e "${YELLOW}Some tests FAILED${NC}"
    echo "========================================"
    exit 1
fi
