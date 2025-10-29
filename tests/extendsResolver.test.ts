import { resolveFileExtends } from '../src/utils/extendsResolver';
import { FileLinkConfig } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('ExtendsResolver - File-Level Extends', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-test-extends-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Basic File Extends Resolution', () => {
    it('should load all links from extended file', () => {
      // Create base config file
      const baseFile = path.join(tempDir, 'filelinks.links.json');
      const baseConfig: FileLinkConfig[] = [
        {
          id: 'link1',
          watch: ['watch1.md'],
          target: ['target1.md'],
        },
        {
          id: 'link2',
          watch: ['watch2.md'],
          target: ['target2.md'],
        },
      ];
      fs.writeFileSync(baseFile, JSON.stringify(baseConfig, null, 2));

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(2);
      expect(result.links[0]).toEqual(baseConfig[0]);
      expect(result.links[1]).toEqual(baseConfig[1]);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });

    it('should resolve file with single link', () => {
      const baseFile = path.join(tempDir, 'filelinks.links.json');
      const baseConfig: FileLinkConfig[] = [
        {
          id: 'single',
          name: 'Single Link',
          description: 'A single link configuration',
          watch: ['src/**/*.ts'],
          target: ['docs/**/*.md'],
          watchType: 'uncommitted',
        },
      ];
      fs.writeFileSync(baseFile, JSON.stringify(baseConfig, null, 2));

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toEqual(baseConfig[0]);
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return error if extends file does not exist', () => {
      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('does not exist');
      expect(result.hasCircularReference).toBe(false);
    });

    it('should return error if extends path is a directory', () => {
      const dirPath = path.join(tempDir, 'filelinks.links.json');
      fs.mkdirSync(dirPath);

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('is not a file');
      expect(result.hasCircularReference).toBe(false);
    });

    it('should return error if extends file is not valid JSON', () => {
      const invalidFile = path.join(tempDir, 'filelinks.links.json');
      fs.writeFileSync(invalidFile, 'invalid json content');

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to parse');
      expect(result.hasCircularReference).toBe(false);
    });

    it('should return error if extends file is not an array', () => {
      const invalidFile = path.join(tempDir, 'filelinks.links.json');
      fs.writeFileSync(invalidFile, JSON.stringify({ not: 'an array' }));

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('must export an array');
      expect(result.hasCircularReference).toBe(false);
    });

    it('should return empty links if extends file is an empty array', () => {
      const emptyFile = path.join(tempDir, 'filelinks.links.json');
      fs.writeFileSync(emptyFile, JSON.stringify([]));

      const result = resolveFileExtends('filelinks.links.json', tempDir);

      // Empty array is technically valid, just returns no links
      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });

    it('should return error if extends file name is invalid', () => {
      const invalidFile = path.join(tempDir, 'invalid-name.json');
      fs.writeFileSync(invalidFile, JSON.stringify([{ watch: ['a'], target: ['b'] }]));

      const result = resolveFileExtends('invalid-name.json', tempDir);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('must have a valid link file name');
      expect(result.hasCircularReference).toBe(false);
    });
  });

  describe('Circular Reference Detection', () => {
    it('should detect direct circular reference', () => {
      const file = path.join(tempDir, 'filelinks.links.json');
      const normalizedPath = path.normalize(file);
      const visitedPaths = new Set<string>([normalizedPath]);

      fs.writeFileSync(
        file,
        JSON.stringify([
          {
            id: 'circular',
            extends: 'filelinks.links.json',
          },
        ])
      );

      const result = resolveFileExtends('filelinks.links.json', tempDir, visitedPaths);

      expect(result.links).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Circular reference detected');
      expect(result.hasCircularReference).toBe(true);
    });

    it('should detect indirect circular reference (A -> B -> A)', () => {
      // Create subdirectories for valid file names
      const subdirA = path.join(tempDir, 'a');
      const subdirB = path.join(tempDir, 'b');
      fs.mkdirSync(subdirA);
      fs.mkdirSync(subdirB);

      // File A extends B
      const fileA = path.join(subdirA, 'filelinks.links.json');
      fs.writeFileSync(
        fileA,
        JSON.stringify([
          {
            id: 'a',
            watch: ['a.md'],
            target: ['a-target.md'],
          },
        ])
      );

      // File B extends A (creating circular reference)
      const fileB = path.join(subdirB, 'filelinks.links.json');
      fs.writeFileSync(
        fileB,
        JSON.stringify([
          {
            id: 'b',
            extends: '../a/filelinks.links.json', // Circular: B -> A, but A is already visited
          },
        ])
      );

      // Start from A with A in visited paths
      const normalizedPathA = path.normalize(fileA);
      const visitedPaths = new Set<string>([normalizedPathA]);

      // Try to resolve B from A's context
      const result = resolveFileExtends('../b/filelinks.links.json', subdirA, visitedPaths);

      // B tries to extend A, which is already in visitedPaths
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.hasCircularReference).toBe(true);
    });

    it('should allow valid chain without circular reference', () => {
      // Create subdirectories for valid file names
      const subdirA = path.join(tempDir, 'a');
      const subdirB = path.join(tempDir, 'b');
      fs.mkdirSync(subdirA);
      fs.mkdirSync(subdirB);

      // File B (no extends)
      const fileB = path.join(subdirB, 'filelinks.links.json');
      fs.writeFileSync(
        fileB,
        JSON.stringify([
          {
            id: 'b',
            watch: ['b.md'],
            target: ['b-target.md'],
          },
        ])
      );

      // File A extends B (valid, no circular reference)
      const fileA = path.join(subdirA, 'filelinks.links.json');
      fs.writeFileSync(
        fileA,
        JSON.stringify([
          {
            id: 'a',
            extends: '../b/filelinks.links.json',
          },
        ])
      );

      const result = resolveFileExtends('a/filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].id).toBe('b');
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });
  });

  describe('Nested Extends Resolution', () => {
    it('should resolve multi-level extends chain', () => {
      // Create subdirectories for valid file names
      const subdirA = path.join(tempDir, 'a');
      const subdirB = path.join(tempDir, 'b');
      const subdirC = path.join(tempDir, 'c');
      fs.mkdirSync(subdirA);
      fs.mkdirSync(subdirB);
      fs.mkdirSync(subdirC);

      // File C (base, no extends)
      const fileC = path.join(subdirC, 'filelinks.links.json');
      fs.writeFileSync(
        fileC,
        JSON.stringify([
          {
            id: 'c',
            watch: ['c.md'],
            target: ['c-target.md'],
          },
        ])
      );

      // File B extends C
      const fileB = path.join(subdirB, 'filelinks.links.json');
      fs.writeFileSync(
        fileB,
        JSON.stringify([
          {
            id: 'b',
            extends: '../c/filelinks.links.json',
          },
        ])
      );

      // File A extends B
      const fileA = path.join(subdirA, 'filelinks.links.json');
      fs.writeFileSync(
        fileA,
        JSON.stringify([
          {
            id: 'a',
            extends: '../b/filelinks.links.json',
          },
        ])
      );

      const result = resolveFileExtends('a/filelinks.links.json', tempDir);

      // Should get link from C (through A -> B -> C)
      expect(result.links).toHaveLength(1);
      expect(result.links[0].id).toBe('c');
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });

    it('should include links from all levels', () => {
      // Create subdirectories for valid file names
      const subdirB = path.join(tempDir, 'b');
      const subdirC = path.join(tempDir, 'c');
      fs.mkdirSync(subdirB);
      fs.mkdirSync(subdirC);

      // File C with 2 links
      const fileC = path.join(subdirC, 'filelinks.links.json');
      fs.writeFileSync(
        fileC,
        JSON.stringify([
          {
            id: 'c1',
            watch: ['c1.md'],
            target: ['c1-target.md'],
          },
          {
            id: 'c2',
            watch: ['c2.md'],
            target: ['c2-target.md'],
          },
        ])
      );

      // File B with 1 link + extends C
      const fileB = path.join(subdirB, 'filelinks.links.json');
      fs.writeFileSync(
        fileB,
        JSON.stringify([
          {
            id: 'b1',
            watch: ['b1.md'],
            target: ['b1-target.md'],
          },
          {
            id: 'b-extends',
            extends: '../c/filelinks.links.json',
          },
        ])
      );

      const result = resolveFileExtends('b/filelinks.links.json', tempDir);

      // Should get 1 direct link from B + 2 links from C = 3 total
      expect(result.links).toHaveLength(3);
      expect(result.links.map((l) => l.id)).toEqual(['b1', 'c1', 'c2']);
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative extends paths', () => {
      // Create subdirectory
      const subdir = path.join(tempDir, 'shared');
      fs.mkdirSync(subdir);

      const sharedFile = path.join(subdir, 'filelinks.links.json');
      fs.writeFileSync(
        sharedFile,
        JSON.stringify([
          {
            id: 'shared',
            watch: ['shared.md'],
            target: ['shared-target.md'],
          },
        ])
      );

      const result = resolveFileExtends('shared/filelinks.links.json', tempDir);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].id).toBe('shared');
      expect(result.errors).toHaveLength(0);
      expect(result.hasCircularReference).toBe(false);
    });

    it('should handle different valid link file names', () => {
      // Test .filelinksrc.json
      const fileA = path.join(tempDir, '.filelinksrc.json');
      fs.writeFileSync(
        fileA,
        JSON.stringify([
          {
            id: 'dotfile',
            watch: ['a.md'],
            target: ['a-target.md'],
          },
        ])
      );

      const resultA = resolveFileExtends('.filelinksrc.json', tempDir);
      expect(resultA.links).toHaveLength(1);
      expect(resultA.errors).toHaveLength(0);

      // Test .filelinksrc
      const fileB = path.join(tempDir, '.filelinksrc');
      fs.writeFileSync(
        fileB,
        JSON.stringify([
          {
            id: 'dotfile-no-ext',
            watch: ['b.md'],
            target: ['b-target.md'],
          },
        ])
      );

      const resultB = resolveFileExtends('.filelinksrc', tempDir);
      expect(resultB.links).toHaveLength(1);
      expect(resultB.errors).toHaveLength(0);
    });
  });
});
