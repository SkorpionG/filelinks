import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { isWithinRepository, requireWithinRepository } from '../src/utils/security';

describe('Security utilities', () => {
  let testDir: string;
  let gitRoot: string;

  beforeEach(() => {
    // Create temporary test directory structure
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-security-test-'));
    gitRoot = path.join(testDir, 'repo');
    fs.mkdirSync(gitRoot);
    fs.mkdirSync(path.join(gitRoot, 'src'));
    fs.writeFileSync(path.join(gitRoot, 'file.txt'), 'test');
    fs.writeFileSync(path.join(gitRoot, 'src', 'test.ts'), 'test');
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('isWithinRepository', () => {
    describe('valid paths', () => {
      it('should accept file in repository root', () => {
        const filePath = path.join(gitRoot, 'file.txt');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept file in subdirectory', () => {
        const filePath = path.join(gitRoot, 'src', 'test.ts');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should accept relative path within repository', () => {
        const filePath = './src/test.ts';
        // Change to gitRoot context
        const absolutePath = path.join(gitRoot, filePath);
        const result = isWithinRepository(absolutePath, gitRoot);

        expect(result.isValid).toBe(true);
      });

      it('should handle path with . (current directory)', () => {
        const filePath = path.join(gitRoot, '.', 'file.txt');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(true);
      });
    });

    describe('invalid paths - parent directory traversal', () => {
      it('should reject path with ../ going outside repository', () => {
        const filePath = path.join(gitRoot, '..', 'outside.txt');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Path points outside the git repository');
        expect(result.errorDetails).toBeDefined();
        expect(result.errorDetails?.length).toBeGreaterThan(0);
      });

      it('should reject multiple ../ traversal attempts', () => {
        const filePath = path.join(gitRoot, '..', '..', 'outside.txt');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Path points outside the git repository');
      });

      it('should reject path starting with ../', () => {
        const filePath = '../outside.txt';
        const absolutePath = path.resolve(gitRoot, filePath);
        const result = isWithinRepository(absolutePath, gitRoot);

        expect(result.isValid).toBe(false);
      });
    });

    describe('invalid paths - absolute path escapes', () => {
      it('should reject absolute path outside repository', () => {
        const outsidePath = path.join(testDir, 'outside.txt');
        const result = isWithinRepository(outsidePath, gitRoot);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Path points outside the git repository');
      });

      it('should reject absolute path to different directory', () => {
        const result = isWithinRepository('/tmp/other/file.txt', gitRoot);

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Path points outside the git repository');
      });

      it('should accept absolute path within repository', () => {
        const absolutePath = path.join(gitRoot, 'src', 'test.ts');
        const result = isWithinRepository(absolutePath, gitRoot);

        expect(result.isValid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle paths with redundant separators', () => {
        const filePath = path.join(gitRoot, 'src', '.', 'test.ts');
        const result = isWithinRepository(filePath, gitRoot);

        expect(result.isValid).toBe(true);
      });

      it('should handle gitRoot with trailing slash', () => {
        const gitRootWithSlash = gitRoot + path.sep;
        const filePath = path.join(gitRoot, 'file.txt');
        const result = isWithinRepository(filePath, gitRootWithSlash);

        expect(result.isValid).toBe(true);
      });

      it('should handle empty relative path (same as gitRoot)', () => {
        const result = isWithinRepository(gitRoot, gitRoot);

        expect(result.isValid).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should provide error details when path is outside repo', () => {
        const outsidePath = path.join(testDir, 'outside.txt');
        const result = isWithinRepository(outsidePath, gitRoot);

        expect(result.isValid).toBe(false);
        expect(result.errorDetails).toBeDefined();
        expect(result.errorDetails?.some((detail) => detail.includes('Repository root'))).toBe(
          true
        );
        expect(result.errorDetails?.some((detail) => detail.includes('Resolved path'))).toBe(true);
      });
    });
  });

  describe('requireWithinRepository', () => {
    it('should not throw for valid path', () => {
      const filePath = path.join(gitRoot, 'file.txt');

      expect(() => {
        requireWithinRepository(filePath, gitRoot);
      }).not.toThrow();
    });

    it('should throw for path outside repository', () => {
      const outsidePath = path.join(testDir, 'outside.txt');

      expect(() => {
        requireWithinRepository(outsidePath, gitRoot);
      }).toThrow('Path points outside the git repository');
    });

    it('should throw for parent directory traversal', () => {
      const filePath = path.join(gitRoot, '..', 'outside.txt');

      expect(() => {
        requireWithinRepository(filePath, gitRoot);
      }).toThrow();
    });

    it('should throw with error details', () => {
      const outsidePath = path.join(testDir, 'outside.txt');

      expect(() => {
        requireWithinRepository(outsidePath, gitRoot);
      }).toThrow(/Repository root/);
    });
  });
});
