import * as fs from 'fs';
import * as path from 'path';
import {
  validateLinkFilePath,
  validateAndNormalizeLinkFilePath,
} from '../src/utils/linkFileValidation';

// Mock filesystem
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('linkFileValidation', () => {
  const mockGitRoot = '/mock/repo';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLinkFilePath', () => {
    describe('file existence checks', () => {
      it('should fail if file does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = validateLinkFilePath('/path/to/filelinks.links.json');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('File not found');
        expect(result.errorDetails?.join(' ')).toContain('does not exist');
      });

      it('should pass if file exists and is valid', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/filelinks.links.json', mockGitRoot);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('directory detection', () => {
      it('should fail if path is a directory', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

        const result = validateLinkFilePath('/path/to/directory');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Path is a directory, not a file');
        expect(result.errorDetails?.join(' ')).toContain('Expected a link file');
        expect(result.errorDetails?.join(' ')).toContain('Please specify the full path');
      });

      it('should pass if path is a file', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/filelinks.links.json', mockGitRoot);

        expect(result.valid).toBe(true);
      });
    });

    describe('filename validation', () => {
      it('should accept filelinks.links.json', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/filelinks.links.json', mockGitRoot);

        expect(result.valid).toBe(true);
      });

      it('should accept .filelinksrc.json', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/.filelinksrc.json', mockGitRoot);

        expect(result.valid).toBe(true);
      });

      it('should accept .filelinksrc', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/.filelinksrc', mockGitRoot);

        expect(result.valid).toBe(true);
      });

      it('should reject invalid filename', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/invalid.json', mockGitRoot);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid link file name');
        expect(result.errorDetails).toContain('Link files must be named one of:');
        expect(result.errorDetails).toContain('  • filelinks.links.json');
        expect(result.errorDetails).toContain('  • .filelinksrc.json');
        expect(result.errorDetails).toContain('  • .filelinksrc');
        expect(result.errorDetails).toContain('Got: invalid.json');
      });

      it('should reject random.txt', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/random.txt');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid link file name');
      });
    });

    describe('repository boundary checks', () => {
      it('should reject file outside repository (parent directory)', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        // File is at /mock/filelinks.links.json (parent of /mock/repo)
        const result = validateLinkFilePath('/mock/filelinks.links.json', '/mock/repo');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Security: File is outside the repository');
        expect(result.errorDetails?.join(' ')).toContain(
          'Refusing to access file outside repository'
        );
        expect(result.errorDetails?.join(' ')).toContain('Repository root: /mock/repo');
      });

      it('should reject file with absolute path escape', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/etc/filelinks.links.json', '/mock/repo');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Security: File is outside the repository');
      });

      it('should accept file within repository', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/src/filelinks.links.json', '/mock/repo');

        expect(result.valid).toBe(true);
      });

      it('should accept file at repository root', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/filelinks.links.json', '/mock/repo');

        expect(result.valid).toBe(true);
      });

      it('should skip repository check if gitRoot not provided', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        // No gitRoot provided, so no repository boundary check
        const result = validateLinkFilePath('/anywhere/filelinks.links.json');

        expect(result.valid).toBe(true);
      });
    });

    describe('combined validations', () => {
      it('should fail with first error encountered (file not found)', () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = validateLinkFilePath('/mock/repo/invalid.json', mockGitRoot);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('File not found');
        // Should not check other validations if file doesn't exist
      });

      it('should check directory before filename', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

        const result = validateLinkFilePath('/mock/repo/directory', mockGitRoot);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Path is a directory, not a file');
      });

      it('should check filename before repository boundary', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        const result = validateLinkFilePath('/mock/invalid.json', '/mock/repo');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid link file name');
      });
    });
  });

  describe('validateAndNormalizeLinkFilePath', () => {
    it('should return absolute path for valid file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      const absolutePath = validateAndNormalizeLinkFilePath(
        '/mock/repo/filelinks.links.json',
        mockGitRoot
      );

      expect(absolutePath).toBe(path.resolve('/mock/repo/filelinks.links.json'));
    });

    it('should throw error for invalid file', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => {
        validateAndNormalizeLinkFilePath('/mock/repo/filelinks.links.json', mockGitRoot);
      }).toThrow('File not found');
    });

    it('should throw error with details for directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

      expect(() => {
        validateAndNormalizeLinkFilePath('/mock/repo/directory', mockGitRoot);
      }).toThrow(/Path is a directory/);
    });

    it('should throw error with details for invalid filename', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      expect(() => {
        validateAndNormalizeLinkFilePath('/mock/repo/invalid.json', mockGitRoot);
      }).toThrow(/Invalid link file name/);
    });

    it('should throw error with details for file outside repo', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      expect(() => {
        validateAndNormalizeLinkFilePath('/mock/filelinks.links.json', '/mock/repo');
      }).toThrow(/Security: File is outside the repository/);
    });
  });

  describe('edge cases', () => {
    it('should handle relative paths', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      validateLinkFilePath('./filelinks.links.json', mockGitRoot);

      // Should resolve relative path and validate
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should handle paths with .. (parent directory)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      const result = validateLinkFilePath('../filelinks.links.json', mockGitRoot);

      // Should resolve and check if outside repo
      expect(result.valid).toBe(false);
    });

    it('should handle symlinks as files', () => {
      mockFs.existsSync.mockReturnValue(true);
      // statSync follows symlinks by default, so this is valid
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

      const result = validateLinkFilePath('/mock/repo/filelinks.links.json', mockGitRoot);

      expect(result.valid).toBe(true);
    });
  });
});
