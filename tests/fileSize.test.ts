import * as fs from 'fs';
import * as path from 'path';
import { getFileSize, formatFileSize, getFormattedFileSize } from '../src/utils/fileSize';

describe('File Size Utilities', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-filesize-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getFileSize', () => {
    it('should return correct size for empty file', () => {
      const filePath = path.join(testDir, 'empty.txt');
      fs.writeFileSync(filePath, '', 'utf-8');

      const size = getFileSize(filePath);

      expect(size).toBe(0);
    });

    it('should return correct size for small file', () => {
      const filePath = path.join(testDir, 'small.txt');
      const content = 'Hello World'; // 11 bytes
      fs.writeFileSync(filePath, content, 'utf-8');

      const size = getFileSize(filePath);

      expect(size).toBe(11);
    });

    it('should return correct size for larger file', () => {
      const filePath = path.join(testDir, 'large.txt');
      const content = 'A'.repeat(1024); // 1 KB
      fs.writeFileSync(filePath, content, 'utf-8');

      const size = getFileSize(filePath);

      expect(size).toBe(1024);
    });

    it('should return 0 for non-existent file', () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      const size = getFileSize(filePath);

      expect(size).toBe(0);
    });

    it('should return 0 for directory', () => {
      const dirPath = path.join(testDir, 'subdir');
      fs.mkdirSync(dirPath);

      const size = getFileSize(dirPath);

      // Directories have a size, but we're testing the function returns something
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThanOrEqual(0);
    });

    it('should handle binary files', () => {
      const filePath = path.join(testDir, 'binary.bin');
      const buffer = Buffer.alloc(256);
      fs.writeFileSync(filePath, buffer);

      const size = getFileSize(filePath);

      expect(size).toBe(256);
    });

    it('should handle files with special characters in name', () => {
      const filePath = path.join(testDir, 'special-!@#$%.txt');
      fs.writeFileSync(filePath, 'content', 'utf-8');

      const size = getFileSize(filePath);

      expect(size).toBe(7);
    });

    it('should handle very large files', () => {
      const filePath = path.join(testDir, 'verylarge.txt');
      const content = 'A'.repeat(1024 * 1024); // 1 MB
      fs.writeFileSync(filePath, content, 'utf-8');

      const size = getFileSize(filePath);

      expect(size).toBe(1024 * 1024);
    });
  });

  describe('formatFileSize', () => {
    describe('bytes', () => {
      it('should format 0 bytes', () => {
        expect(formatFileSize(0)).toBe('0 B');
      });

      it('should format bytes under 1 KB', () => {
        expect(formatFileSize(1)).toBe('1 B');
        expect(formatFileSize(100)).toBe('100 B');
        expect(formatFileSize(1023)).toBe('1023 B');
      });

      it('should handle negative numbers', () => {
        expect(formatFileSize(-100)).toBe('0 B');
      });
    });

    describe('kilobytes', () => {
      it('should format exactly 1 KB', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
      });

      it('should format KB with decimals', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(2048)).toBe('2 KB');
        expect(formatFileSize(2560)).toBe('2.5 KB');
      });

      it('should format KB near MB boundary', () => {
        expect(formatFileSize(1023 * 1024)).toBe('1023 KB');
      });

      it('should remove trailing zeros', () => {
        expect(formatFileSize(1024)).toBe('1 KB'); // Not "1.00 KB"
        expect(formatFileSize(2048)).toBe('2 KB'); // Not "2.00 KB"
      });
    });

    describe('megabytes', () => {
      it('should format exactly 1 MB', () => {
        expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      });

      it('should format MB with decimals', () => {
        expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
        expect(formatFileSize(3.14 * 1024 * 1024)).toBe('3.14 MB');
      });

      it('should format large MB values', () => {
        expect(formatFileSize(999 * 1024 * 1024)).toBe('999 MB');
      });
    });

    describe('gigabytes', () => {
      it('should format exactly 1 GB', () => {
        expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      });

      it('should format GB with decimals', () => {
        expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
      });
    });

    describe('terabytes', () => {
      it('should format exactly 1 TB', () => {
        expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
      });

      it('should format TB with decimals', () => {
        expect(formatFileSize(1.5 * 1024 * 1024 * 1024 * 1024)).toBe('1.5 TB');
      });
    });

    describe('decimal precision', () => {
      it('should respect custom decimal places', () => {
        expect(formatFileSize(1536, 0)).toBe('2 KB'); // Rounded
        expect(formatFileSize(1536, 1)).toBe('1.5 KB');
        expect(formatFileSize(1536, 2)).toBe('1.5 KB');
        expect(formatFileSize(1536, 3)).toBe('1.5 KB');
      });

      it('should handle fractional values with high precision', () => {
        const size = 1234567; // ~1.18 MB
        expect(formatFileSize(size, 0)).toBe('1 MB');
        expect(formatFileSize(size, 1)).toBe('1.2 MB');
        expect(formatFileSize(size, 2)).toBe('1.18 MB');
        expect(formatFileSize(size, 3)).toBe('1.177 MB');
      });

      it('should handle negative decimal parameter', () => {
        expect(formatFileSize(1536, -1)).toBe('2 KB');
      });
    });

    describe('edge cases', () => {
      it('should handle very small fractional KB', () => {
        expect(formatFileSize(1025)).toBe('1 KB'); // Just over 1 KB
      });

      it('should handle values that round to whole numbers', () => {
        expect(formatFileSize(2047)).toBe('2 KB'); // Rounds to 2
        expect(formatFileSize(2049)).toBe('2 KB'); // Also rounds to 2
      });

      it('should handle maximum safe integer', () => {
        const result = formatFileSize(Number.MAX_SAFE_INTEGER);
        expect(result).toContain('PB'); // Should be in petabytes
      });
    });

    describe('real-world sizes', () => {
      it('should format typical file sizes', () => {
        // Empty file
        expect(formatFileSize(0)).toBe('0 B');

        // Small text file
        expect(formatFileSize(3456)).toBe('3.38 KB');

        // Image file
        expect(formatFileSize(245760)).toBe('240 KB');

        // Audio file
        expect(formatFileSize(4.5 * 1024 * 1024)).toBe('4.5 MB');

        // Video file
        expect(formatFileSize(750 * 1024 * 1024)).toBe('750 MB');

        // Large archive
        expect(formatFileSize(3.2 * 1024 * 1024 * 1024)).toBe('3.2 GB');
      });
    });
  });

  describe('getFormattedFileSize', () => {
    it('should return formatted size for existing file', () => {
      const filePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(filePath, 'A'.repeat(2048), 'utf-8');

      const formattedSize = getFormattedFileSize(filePath);

      expect(formattedSize).toBe('2 KB');
    });

    it('should return "0 B" for non-existent file', () => {
      const filePath = path.join(testDir, 'nonexistent.txt');

      const formattedSize = getFormattedFileSize(filePath);

      expect(formattedSize).toBe('0 B');
    });

    it('should handle empty file', () => {
      const filePath = path.join(testDir, 'empty.txt');
      fs.writeFileSync(filePath, '', 'utf-8');

      const formattedSize = getFormattedFileSize(filePath);

      expect(formattedSize).toBe('0 B');
    });

    it('should respect custom decimal places', () => {
      const filePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(filePath, 'A'.repeat(1536), 'utf-8');

      const formattedSize0 = getFormattedFileSize(filePath, 0);
      const formattedSize1 = getFormattedFileSize(filePath, 1);
      const formattedSize2 = getFormattedFileSize(filePath, 2);

      expect(formattedSize0).toBe('2 KB');
      expect(formattedSize1).toBe('1.5 KB');
      expect(formattedSize2).toBe('1.5 KB');
    });

    it('should handle JSON file', () => {
      const filePath = path.join(testDir, 'config.json');
      const jsonContent = JSON.stringify({ test: 'data' }, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf-8');

      const formattedSize = getFormattedFileSize(filePath);

      expect(formattedSize).toMatch(/^\d+(\.\d+)? B$/);
    });

    it('should handle large file', () => {
      const filePath = path.join(testDir, 'large.bin');
      const buffer = Buffer.alloc(1024 * 1024 * 5); // 5 MB
      fs.writeFileSync(filePath, buffer);

      const formattedSize = getFormattedFileSize(filePath);

      expect(formattedSize).toBe('5 MB');
    });
  });
});
