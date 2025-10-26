import * as fs from 'fs';
import * as path from 'path';
import { LINK_FILE_NAMES } from '../../src/constants';

// Mock chalk to avoid ESM import issues in Jest
jest.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    dim: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

// Mock the UI module to avoid chalk import issues in Jest
jest.mock('../../src/utils/ui', () => ({
  displayCommandHeader: jest.fn(),
  displayWarning: jest.fn(),
  displaySuccess: jest.fn(),
  displayHeader: jest.fn(),
  displayDim: jest.fn(),
  displayList: jest.fn(),
  displayBlankLine: jest.fn(),
  displayError: jest.fn(),
}));

// Import after mocking to ensure mocks are in place
import {
  findLinkFilesInDirectory,
  findLinkFilesRecursive,
  groupLinkFilesByDirectory,
  countLinksInFile,
} from '../../src/commands/list';

describe('List Command Functions', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-list-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findLinkFilesInDirectory', () => {
    it('should find a single link file in the directory', () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      const result = findLinkFilesInDirectory(testDir);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(linkFilePath);
    });

    it('should find multiple link file names in the same directory', () => {
      // Create multiple valid link file names
      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(testDir, '.filelinksrc.json');
      fs.writeFileSync(file1, JSON.stringify([]), 'utf-8');
      fs.writeFileSync(file2, JSON.stringify([]), 'utf-8');

      const result = findLinkFilesInDirectory(testDir);

      expect(result).toHaveLength(2);
      expect(result).toContain(file1);
      expect(result).toContain(file2);
    });

    it('should return empty array when no link files exist', () => {
      const result = findLinkFilesInDirectory(testDir);

      expect(result).toHaveLength(0);
    });

    it('should only check the specified directory (not subdirectories)', () => {
      // Create a link file in a subdirectory
      const subDir = path.join(testDir, 'sub');
      fs.mkdirSync(subDir, { recursive: true });
      const subLinkFile = path.join(subDir, 'filelinks.links.json');
      fs.writeFileSync(subLinkFile, JSON.stringify([]), 'utf-8');

      const result = findLinkFilesInDirectory(testDir);

      expect(result).toHaveLength(0);
    });

    it('should find all supported link file names', () => {
      // Create all supported link file names
      const files = LINK_FILE_NAMES.map((name) => {
        const filePath = path.join(testDir, name);
        fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');
        return filePath;
      });

      const result = findLinkFilesInDirectory(testDir);

      expect(result).toHaveLength(LINK_FILE_NAMES.length);
      files.forEach((file) => {
        expect(result).toContain(file);
      });
    });
  });

  describe('findLinkFilesRecursive', () => {
    it('should find link files in the root directory', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(linkFilePath);
    });

    it('should find link files in subdirectories', async () => {
      // Create nested structure
      const subDir1 = path.join(testDir, 'src');
      const subDir2 = path.join(testDir, 'src', 'components');
      fs.mkdirSync(subDir1, { recursive: true });
      fs.mkdirSync(subDir2, { recursive: true });

      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(subDir1, 'filelinks.links.json');
      const file3 = path.join(subDir2, 'filelinks.links.json');

      fs.writeFileSync(file1, JSON.stringify([]), 'utf-8');
      fs.writeFileSync(file2, JSON.stringify([]), 'utf-8');
      fs.writeFileSync(file3, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(3);
      expect(result).toContain(file1);
      expect(result).toContain(file2);
      expect(result).toContain(file3);
    });

    it('should return empty array when no link files exist', async () => {
      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(0);
    });

    it('should ignore files in node_modules', async () => {
      const nodeModules = path.join(testDir, 'node_modules');
      fs.mkdirSync(nodeModules, { recursive: true });
      const ignoredFile = path.join(nodeModules, 'filelinks.links.json');
      fs.writeFileSync(ignoredFile, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(0);
    });

    it('should ignore files in dist directory', async () => {
      const distDir = path.join(testDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });
      const ignoredFile = path.join(distDir, 'filelinks.links.json');
      fs.writeFileSync(ignoredFile, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(0);
    });

    it('should ignore files in build directory', async () => {
      const buildDir = path.join(testDir, 'build');
      fs.mkdirSync(buildDir, { recursive: true });
      const ignoredFile = path.join(buildDir, 'filelinks.links.json');
      fs.writeFileSync(ignoredFile, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(0);
    });

    it('should return sorted results', async () => {
      const dir1 = path.join(testDir, 'b');
      const dir2 = path.join(testDir, 'a');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const file1 = path.join(dir1, 'filelinks.links.json');
      const file2 = path.join(dir2, 'filelinks.links.json');
      fs.writeFileSync(file1, JSON.stringify([]), 'utf-8');
      fs.writeFileSync(file2, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(2);
      // Results should be sorted alphabetically
      expect(result[0]).toBe(file2); // 'a' comes before 'b'
      expect(result[1]).toBe(file1);
    });

    it('should remove duplicates if same file matches multiple patterns', async () => {
      // This shouldn't normally happen, but test defensive programming
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      // Should only return each file once
      expect(result).toHaveLength(1);
      expect(new Set(result).size).toBe(result.length);
    });

    it('should find different link file name types', async () => {
      const file1 = path.join(testDir, 'filelinks.links.json');
      const subDir = path.join(testDir, 'src');
      fs.mkdirSync(subDir, { recursive: true });
      const file2 = path.join(subDir, '.filelinksrc.json');

      fs.writeFileSync(file1, JSON.stringify([]), 'utf-8');
      fs.writeFileSync(file2, JSON.stringify([]), 'utf-8');

      const result = await findLinkFilesRecursive(testDir);

      expect(result).toHaveLength(2);
      expect(result).toContain(file1);
      expect(result).toContain(file2);
    });
  });

  describe('groupLinkFilesByDirectory', () => {
    it('should group files by their directory', () => {
      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(testDir, 'src', 'filelinks.links.json');
      const file3 = path.join(testDir, 'src', 'components', 'filelinks.links.json');

      const result = groupLinkFilesByDirectory([file1, file2, file3], testDir);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['.']).toEqual([file1]);
      expect(result['src']).toEqual([file2]);
      expect(result[path.join('src', 'components')]).toEqual([file3]);
    });

    it('should handle multiple files in the same directory', () => {
      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(testDir, '.filelinksrc.json');

      const result = groupLinkFilesByDirectory([file1, file2], testDir);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result['.']).toHaveLength(2);
      expect(result['.']).toContain(file1);
      expect(result['.']).toContain(file2);
    });

    it('should handle empty file list', () => {
      const result = groupLinkFilesByDirectory([], testDir);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should use relative paths from rootDir', () => {
      const nestedDir = path.join(testDir, 'a', 'b', 'c');
      const file = path.join(nestedDir, 'filelinks.links.json');

      const result = groupLinkFilesByDirectory([file], testDir);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result[path.join('a', 'b', 'c')]).toEqual([file]);
    });

    it('should preserve order of files within each directory', () => {
      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(testDir, '.filelinksrc.json');
      const file3 = path.join(testDir, '.filelinksrc');

      const result = groupLinkFilesByDirectory([file1, file2, file3], testDir);

      expect(result['.']).toEqual([file1, file2, file3]);
    });

    it('should handle files at different nesting levels', () => {
      const file1 = path.join(testDir, 'filelinks.links.json');
      const file2 = path.join(testDir, 'a', 'filelinks.links.json');
      const file3 = path.join(testDir, 'a', 'b', 'filelinks.links.json');
      const file4 = path.join(testDir, 'a', 'b', 'c', 'filelinks.links.json');

      const result = groupLinkFilesByDirectory([file1, file2, file3, file4], testDir);

      expect(Object.keys(result)).toHaveLength(4);
      expect(result['.']).toEqual([file1]);
      expect(result['a']).toEqual([file2]);
      expect(result[path.join('a', 'b')]).toEqual([file3]);
      expect(result[path.join('a', 'b', 'c')]).toEqual([file4]);
    });

    it('should handle Windows-style paths correctly', () => {
      // Use path.join to ensure cross-platform compatibility
      const file1 = path.join(testDir, 'src', 'components', 'filelinks.links.json');
      const file2 = path.join(testDir, 'src', 'utils', 'filelinks.links.json');

      const result = groupLinkFilesByDirectory([file1, file2], testDir);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[path.join('src', 'components')]).toEqual([file1]);
      expect(result[path.join('src', 'utils')]).toEqual([file2]);
    });
  });

  describe('countLinksInFile', () => {
    it('should return 0 for empty array', () => {
      const filePath = path.join(testDir, 'empty.links.json');
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });

    it('should count single link', () => {
      const filePath = path.join(testDir, 'single.links.json');
      const links = [
        {
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(links), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(1);
    });

    it('should count multiple links', () => {
      const filePath = path.join(testDir, 'multiple.links.json');
      const links = [
        {
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
        },
        {
          watch: ['package.json'],
          target: ['README.md'],
        },
        {
          watch: ['config/*.ts'],
          target: ['docs/config.md'],
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(links), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(3);
    });

    it('should return 0 for non-existent file', () => {
      const filePath = path.join(testDir, 'nonexistent.links.json');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });

    it('should return 0 for invalid JSON', () => {
      const filePath = path.join(testDir, 'invalid.links.json');
      fs.writeFileSync(filePath, 'not valid json', 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });

    it('should return 0 for non-array JSON', () => {
      const filePath = path.join(testDir, 'object.links.json');
      fs.writeFileSync(filePath, JSON.stringify({ links: [] }), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });

    it('should handle file with many links', () => {
      const filePath = path.join(testDir, 'many.links.json');
      const links = Array.from({ length: 50 }, (_, i) => ({
        watch: [`src${i}/**/*.ts`],
        target: [`docs${i}/README.md`],
      }));
      fs.writeFileSync(filePath, JSON.stringify(links), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(50);
    });

    it('should handle file with links containing optional fields', () => {
      const filePath = path.join(testDir, 'optional.links.json');
      const links = [
        {
          id: 'link1',
          name: 'First Link',
          description: 'A test link',
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
          watchType: 'uncommitted',
        },
        {
          watch: ['package.json'],
          target: ['README.md'],
        },
      ];
      fs.writeFileSync(filePath, JSON.stringify(links), 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(2);
    });

    it('should handle empty file', () => {
      const filePath = path.join(testDir, 'empty-file.links.json');
      fs.writeFileSync(filePath, '', 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });

    it('should handle file with whitespace only', () => {
      const filePath = path.join(testDir, 'whitespace.links.json');
      fs.writeFileSync(filePath, '   \n  \t  ', 'utf-8');

      const count = countLinksInFile(filePath);

      expect(count).toBe(0);
    });
  });
});
