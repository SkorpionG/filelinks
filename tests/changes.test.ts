import {
  matchesPattern,
  findMatchingFiles,
  isGlobPattern,
  findFilesMatchingPattern,
} from '../src/utils/changes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Pattern Matching Utilities', () => {
  describe('matchesPattern', () => {
    describe('literal paths', () => {
      it('should match exact file paths', () => {
        expect(matchesPattern('src/index.ts', 'src/index.ts')).toBe(true);
        expect(matchesPattern('README.md', 'README.md')).toBe(true);
      });

      it('should not match different paths', () => {
        expect(matchesPattern('src/index.ts', 'src/other.ts')).toBe(false);
        expect(matchesPattern('README.md', 'CHANGELOG.md')).toBe(false);
      });

      it('should handle paths with subdirectories', () => {
        expect(matchesPattern('src/api/routes.ts', 'src/api/routes.ts')).toBe(true);
        expect(matchesPattern('src/api/routes.ts', 'src/api/handlers.ts')).toBe(false);
      });
    });

    describe('single asterisk (*) patterns', () => {
      it('should match any characters except slash in same directory', () => {
        expect(matchesPattern('src/index.ts', 'src/*.ts')).toBe(true);
        expect(matchesPattern('src/other.ts', 'src/*.ts')).toBe(true);
        expect(matchesPattern('src/index.js', 'src/*.ts')).toBe(false);
      });

      it('should not match files in subdirectories', () => {
        expect(matchesPattern('src/api/routes.ts', 'src/*.ts')).toBe(false);
        expect(matchesPattern('src/utils/git.ts', 'src/*.ts')).toBe(false);
      });

      it('should match multiple wildcards in pattern', () => {
        expect(matchesPattern('src/index.test.ts', 'src/*.test.ts')).toBe(true);
        expect(matchesPattern('tests/unit.spec.js', '*/*.spec.js')).toBe(true);
      });

      it('should handle wildcards at start of pattern', () => {
        expect(matchesPattern('README.md', '*.md')).toBe(true);
        expect(matchesPattern('test.ts', '*.md')).toBe(false);
      });
    });

    describe('double asterisk (**) patterns', () => {
      it('should match files recursively across all directories', () => {
        expect(matchesPattern('src/index.ts', '**/*.ts')).toBe(true);
        expect(matchesPattern('src/api/routes.ts', '**/*.ts')).toBe(true);
        expect(matchesPattern('src/api/v1/handlers.ts', '**/*.ts')).toBe(true);
      });

      it('should match from specific directory recursively', () => {
        expect(matchesPattern('src/api/routes.ts', 'src/**/*.ts')).toBe(true);
        expect(matchesPattern('src/api/v1/handlers.ts', 'src/**/*.ts')).toBe(true);
        expect(matchesPattern('tests/api.test.ts', 'src/**/*.ts')).toBe(false);
      });

      it('should match files at any depth', () => {
        expect(matchesPattern('a/b/c/d/e/f.ts', '**/f.ts')).toBe(true);
        expect(matchesPattern('a/b/c/d/e/f.ts', 'a/**/f.ts')).toBe(true);
        // Note: ** doesn't match zero directories in this implementation
        expect(matchesPattern('f.ts', '**/*.ts')).toBe(false);
      });

      it('should handle ** in middle of pattern', () => {
        expect(matchesPattern('src/api/v1/routes.ts', 'src/**/routes.ts')).toBe(true);
        // Note: ** needs at least one directory
        expect(matchesPattern('src/api/routes.ts', 'src/**/routes.ts')).toBe(true);
      });
    });

    describe('question mark (?) patterns', () => {
      it('should match single character', () => {
        expect(matchesPattern('file1.ts', 'file?.ts')).toBe(true);
        expect(matchesPattern('file2.ts', 'file?.ts')).toBe(true);
        expect(matchesPattern('file12.ts', 'file?.ts')).toBe(false);
      });

      it('should work with multiple ? characters', () => {
        expect(matchesPattern('test12.ts', 'test??.ts')).toBe(true);
        expect(matchesPattern('test1.ts', 'test??.ts')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle empty pattern', () => {
        expect(matchesPattern('file.ts', '')).toBe(false);
      });

      it('should handle empty file path', () => {
        expect(matchesPattern('', 'pattern')).toBe(false);
      });

      it('should handle paths with dots', () => {
        expect(matchesPattern('.gitignore', '.gitignore')).toBe(true);
        expect(matchesPattern('.github/workflows/ci.yml', '.github/**/*.yml')).toBe(true);
      });

      it('should handle paths with spaces', () => {
        expect(matchesPattern('my file.ts', 'my file.ts')).toBe(true);
        expect(matchesPattern('my file.ts', 'my*.ts')).toBe(true);
      });

      it('should normalize paths with path.sep', () => {
        // Pattern matching normalizes using path.sep
        expect(matchesPattern('src/api/routes.ts', 'src/api/routes.ts')).toBe(true);
        expect(matchesPattern('src/api/routes.ts', 'src/**/*.ts')).toBe(true);
      });

      it('should handle very long paths', () => {
        const longPath = 'a/'.repeat(50) + 'file.ts';
        expect(matchesPattern(longPath, '**/file.ts')).toBe(true);
      });

      it('should handle dots in file paths (dots are escaped)', () => {
        expect(matchesPattern('file.ts', 'file.ts')).toBe(true); // dot should be escaped
        expect(matchesPattern('fileXts', 'file.ts')).toBe(false); // dot is not wildcard
      });

      it('should handle paths with underscores only', () => {
        expect(matchesPattern('src/my_file.ts', 'src/my_file.ts')).toBe(true);
        expect(matchesPattern('src/my_folder/file.ts', 'src/my_folder/file.ts')).toBe(true);
        expect(matchesPattern('src/my_folder/my_file.ts', 'src/my_folder/*.ts')).toBe(true);
        expect(matchesPattern('src/my_folder/sub/file.ts', 'src/my_folder/**/*.ts')).toBe(true);
      });

      it('should handle paths with parentheses only (Next.js route groups)', () => {
        expect(matchesPattern('app/(dashboard)/page.tsx', 'app/(dashboard)/page.tsx')).toBe(true);
        expect(matchesPattern('app/(auth)/login/page.tsx', 'app/(auth)/login/page.tsx')).toBe(true);
        expect(matchesPattern('src/(components)/Button.tsx', 'src/(components)/*.tsx')).toBe(true);
        expect(matchesPattern('app/(dashboard)/users/page.tsx', 'app/(dashboard)/**/*.tsx')).toBe(
          true
        );
      });

      it('should handle paths with both parentheses and underscores', () => {
        expect(matchesPattern('app/(auth)/sign_up/page.tsx', 'app/(auth)/sign_up/page.tsx')).toBe(
          true
        );
        expect(
          matchesPattern('src/(components)/my_button.tsx', 'src/(components)/my_button.tsx')
        ).toBe(true);
        expect(matchesPattern('app/(dashboard)/user_profile.tsx', 'app/(dashboard)/*.tsx')).toBe(
          true
        );
        expect(matchesPattern('src/(utils)/my_helper/index.ts', 'src/(utils)/**/*.ts')).toBe(true);
      });

      it('should handle paths with square brackets (Next.js dynamic routes)', () => {
        expect(matchesPattern('app/posts/[id]/page.tsx', 'app/posts/[id]/page.tsx')).toBe(true);
        expect(matchesPattern('app/posts/[slug]/page.tsx', 'app/posts/[slug]/page.tsx')).toBe(true);
        expect(matchesPattern('app/users/[id]/edit.tsx', 'app/users/[id]/*.tsx')).toBe(true);
        expect(matchesPattern('app/posts/[...slug]/page.tsx', 'app/posts/**/*.tsx')).toBe(true);
      });

      it('should handle paths with other special regex characters', () => {
        expect(matchesPattern('src/utils/math+helper.ts', 'src/utils/math+helper.ts')).toBe(true);
        expect(matchesPattern('test/{a,b}.ts', 'test/{a,b}.ts')).toBe(true);
        expect(matchesPattern('file$name.ts', 'file$name.ts')).toBe(true);
        expect(matchesPattern('file^name.ts', 'file^name.ts')).toBe(true);
        expect(matchesPattern('file|name.ts', 'file|name.ts')).toBe(true);
      });
    });

    describe('complex patterns', () => {
      it('should handle combined wildcards', () => {
        expect(matchesPattern('src/api/v1/routes.test.ts', 'src/**/*.test.ts')).toBe(true);
        expect(matchesPattern('src/api/v1/routes.ts', 'src/**/*.test.ts')).toBe(false);
      });

      it('should handle patterns with multiple segments', () => {
        expect(matchesPattern('src/api/routes.ts', 'src/*/routes.ts')).toBe(true);
        expect(matchesPattern('src/api/v1/routes.ts', 'src/*/routes.ts')).toBe(false);
      });
    });
  });

  describe('findMatchingFiles', () => {
    it('should find files matching single pattern', () => {
      const changedFiles = ['src/index.ts', 'src/api.ts', 'README.md'];
      const patterns = ['src/*.ts'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(2);
      expect(matches).toContain('src/index.ts');
      expect(matches).toContain('src/api.ts');
      expect(matches).not.toContain('README.md');
    });

    it('should find files matching multiple patterns', () => {
      const changedFiles = ['src/index.ts', 'docs/API.md', 'README.md'];
      const patterns = ['src/*.ts', '*.md'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(2);
      expect(matches).toContain('src/index.ts');
      expect(matches).toContain('README.md');
      expect(matches).not.toContain('docs/API.md');
    });

    it('should find files with recursive patterns', () => {
      const changedFiles = [
        'src/index.ts',
        'src/api/routes.ts',
        'src/api/v1/handlers.ts',
        'tests/unit.test.ts',
      ];
      const patterns = ['src/**/*.ts'];
      const matches = findMatchingFiles(changedFiles, patterns);

      // Note: src/index.ts doesn't match src/**/*.ts (needs subdirectory)
      expect(matches).toHaveLength(2);
      expect(matches).toContain('src/api/routes.ts');
      expect(matches).toContain('src/api/v1/handlers.ts');
      expect(matches).not.toContain('src/index.ts');
      expect(matches).not.toContain('tests/unit.test.ts');
    });

    it('should return empty array when no files match', () => {
      const changedFiles = ['src/index.ts', 'src/api.ts'];
      const patterns = ['*.md'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty changed files array', () => {
      const changedFiles: string[] = [];
      const patterns = ['src/*.ts'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty patterns array', () => {
      const changedFiles = ['src/index.ts', 'src/api.ts'];
      const patterns: string[] = [];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(0);
    });

    it('should deduplicate files matching multiple patterns', () => {
      const changedFiles = ['src/index.ts'];
      const patterns = ['src/*.ts', 'src/index.ts'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(1);
      expect(matches).toContain('src/index.ts');
    });

    it('should handle paths with forward slashes', () => {
      const changedFiles = ['src/api/routes.ts', 'src/utils/git.ts'];
      const patterns = ['src/**/*.ts'];
      const matches = findMatchingFiles(changedFiles, patterns);

      // Both files in subdirectories match src/**/*.ts
      expect(matches).toHaveLength(2);
      expect(matches).toContain('src/api/routes.ts');
      expect(matches).toContain('src/utils/git.ts');
    });

    it('should handle literal file paths as patterns', () => {
      const changedFiles = ['src/index.ts', 'src/api.ts', 'README.md'];
      const patterns = ['src/index.ts', 'README.md'];
      const matches = findMatchingFiles(changedFiles, patterns);

      expect(matches).toHaveLength(2);
      expect(matches).toContain('src/index.ts');
      expect(matches).toContain('README.md');
    });
  });

  describe('isGlobPattern', () => {
    it('should identify patterns with single asterisk', () => {
      expect(isGlobPattern('*.md')).toBe(true);
      expect(isGlobPattern('src/*.ts')).toBe(true);
      expect(isGlobPattern('file.*.js')).toBe(true);
    });

    it('should identify patterns with double asterisk', () => {
      expect(isGlobPattern('**/*.md')).toBe(true);
      expect(isGlobPattern('src/**/*.ts')).toBe(true);
      expect(isGlobPattern('**/test.js')).toBe(true);
    });

    it('should identify patterns with question mark', () => {
      expect(isGlobPattern('file?.ts')).toBe(true);
      expect(isGlobPattern('test??.js')).toBe(true);
    });

    it('should identify patterns with mixed wildcards', () => {
      expect(isGlobPattern('src/**/*.test.ts')).toBe(true);
      expect(isGlobPattern('test/*.spec.?s')).toBe(true);
    });

    it('should return false for literal paths without wildcards', () => {
      expect(isGlobPattern('src/index.ts')).toBe(false);
      expect(isGlobPattern('README.md')).toBe(false);
      expect(isGlobPattern('src/api/routes.ts')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isGlobPattern('')).toBe(false);
    });

    it('should handle paths with special characters but no wildcards', () => {
      expect(isGlobPattern('file.name.ts')).toBe(false);
      expect(isGlobPattern('src/(auth)/login.ts')).toBe(false);
      expect(isGlobPattern('app/[id]/page.tsx')).toBe(false);
    });
  });

  describe('findFilesMatchingPattern', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should find files matching glob pattern', async () => {
      // Create test files
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'docs', 'readme.md'), '');
      fs.writeFileSync(path.join(tempDir, 'docs', 'guide.md'), '');
      fs.writeFileSync(path.join(tempDir, 'docs', 'config.json'), '');

      const matches = await findFilesMatchingPattern('docs/*.md', tempDir);

      expect(matches).toHaveLength(2);
      expect(matches).toContain('docs/readme.md');
      expect(matches).toContain('docs/guide.md');
      expect(matches).not.toContain('docs/config.json');
    });

    it('should find files matching recursive glob pattern', async () => {
      // Create nested directory structure
      fs.mkdirSync(path.join(tempDir, 'src', 'api'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'src', 'utils'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src', 'api', 'routes.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src', 'utils', 'helpers.ts'), '');

      const matches = await findFilesMatchingPattern('src/**/*.ts', tempDir);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches).toContain('src/api/routes.ts');
      expect(matches).toContain('src/utils/helpers.ts');
    });

    it('should return single file for non-glob pattern when file exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'README.md'), '');

      const matches = await findFilesMatchingPattern('README.md', tempDir);

      expect(matches).toHaveLength(1);
      expect(matches).toContain('README.md');
    });

    it('should return empty array for non-glob pattern when file does not exist', async () => {
      const matches = await findFilesMatchingPattern('NONEXISTENT.md', tempDir);

      expect(matches).toHaveLength(0);
    });

    it('should return empty array when glob pattern matches no files', async () => {
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'docs', 'config.json'), '');

      const matches = await findFilesMatchingPattern('docs/*.md', tempDir);

      expect(matches).toHaveLength(0);
    });

    it('should not return directories', async () => {
      fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'README.md'), '');

      const matches = await findFilesMatchingPattern('*', tempDir);

      expect(matches).toContain('README.md');
      expect(matches).not.toContain('docs');
    });

    it('should handle patterns with question mark wildcard', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'file2.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'file12.ts'), '');

      const matches = await findFilesMatchingPattern('file?.ts', tempDir);

      expect(matches).toHaveLength(2);
      expect(matches).toContain('file1.ts');
      expect(matches).toContain('file2.ts');
      expect(matches).not.toContain('file12.ts');
    });

    it('should include dotfiles when pattern matches them', async () => {
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '');
      fs.writeFileSync(path.join(tempDir, '.env'), '');
      fs.writeFileSync(path.join(tempDir, 'README.md'), '');

      const matches = await findFilesMatchingPattern('.*', tempDir);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches).toContain('.gitignore');
      expect(matches).toContain('.env');
    });

    it('should handle empty directory', async () => {
      const matches = await findFilesMatchingPattern('**/*.md', tempDir);

      expect(matches).toHaveLength(0);
    });

    it('should return empty array for invalid pattern', async () => {
      const matches = await findFilesMatchingPattern('', tempDir);

      expect(matches).toHaveLength(0);
    });
  });
});
