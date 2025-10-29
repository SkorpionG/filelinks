import {
  validateRootConfig,
  validateLinksConfig,
  combineValidationResults,
} from '../src/utils/validation';
import { RootConfig, FileLinkConfigArray } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Validation', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateRootConfig', () => {
    describe('Structure Validation', () => {
      it('should accept valid root config', () => {
        const testFile = path.join(tempDir, 'filelinks.links.json');
        fs.writeFileSync(testFile, '[]');

        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: path.relative(tempDir, testFile) }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject config without linkFiles property', () => {
        const config = {} as RootConfig;
        const result = validateRootConfig(config, tempDir);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('must have a "linkFiles" property');
      });

      it('should reject config with non-array linkFiles', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = { linkFiles: 'not-an-array' } as any;
        const result = validateRootConfig(config, tempDir);

        expect(result.valid).toBe(false);
        expect(result.errors[0].message).toContain('"linkFiles" must be an array');
      });

      it('should warn about empty linkFiles array', () => {
        const config: RootConfig = { linkFiles: [] };
        const result = validateRootConfig(config, tempDir);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain('No link files configured');
      });
    });

    describe('Property Validation', () => {
      it('should reject linkFile without id property', () => {
        const config: RootConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkFiles: [{ name: 'Test', path: './test.json' } as any],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"id" property'))).toBe(true);
      });

      it('should reject linkFile with empty id string', () => {
        const config: RootConfig = {
          linkFiles: [{ id: '  ', name: 'Test', path: './test.json' }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot be an empty string'))).toBe(
          true
        );
      });

      it('should reject linkFile without name property', () => {
        const config: RootConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkFiles: [{ id: 'test', path: './test.json' } as any],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"name" property'))).toBe(true);
      });

      it('should reject linkFile without path property', () => {
        const config: RootConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkFiles: [{ id: 'test', name: 'Test' } as any],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"path" property'))).toBe(true);
      });

      it('should reject linkFile with non-string properties', () => {
        const config: RootConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkFiles: [{ id: 123, name: true, path: null } as any],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject empty object as linkFile', () => {
        const config: RootConfig = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkFiles: [{}] as any,
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3); // id, name, path missing
      });
    });

    describe('Duplicate Detection', () => {
      it('should detect duplicate IDs', () => {
        const testFile = path.join(tempDir, 'test.json');
        fs.writeFileSync(testFile, '[]');

        const config: RootConfig = {
          linkFiles: [
            { id: 'test', name: 'Test 1', path: path.relative(tempDir, testFile) },
            { id: 'test', name: 'Test 2', path: path.relative(tempDir, testFile) },
          ],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('Duplicate link file ID'))).toBe(true);
      });

      it('should detect duplicate paths with different formats', () => {
        const testFile = path.join(tempDir, 'test.json');
        fs.writeFileSync(testFile, '[]');

        const config: RootConfig = {
          linkFiles: [
            { id: 'test1', name: 'Test 1', path: './test.json' },
            { id: 'test2', name: 'Test 2', path: 'test.json' },
          ],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('Duplicate link file path'))).toBe(
          true
        );
      });
    });

    describe('File Validation', () => {
      it('should reject non-existent file', () => {
        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: './nonexistent.json' }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('does not exist'))).toBe(true);
      });

      it('should reject directory as file path', () => {
        const testDir = path.join(tempDir, 'testdir');
        fs.mkdirSync(testDir);

        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: path.relative(tempDir, testDir) }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('not a file'))).toBe(true);
      });

      it('should reject file with invalid name', () => {
        const testFile = path.join(tempDir, 'invalid.txt');
        fs.writeFileSync(testFile, '[]');

        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: path.relative(tempDir, testFile) }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('valid link file name'))).toBe(true);
      });
    });

    describe('Security Validation', () => {
      it('should reject path outside repository (parent directory)', () => {
        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: '../outside.json' }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('outside the repository'))).toBe(true);
      });

      it('should reject absolute path', () => {
        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: '/absolute/path.json' }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('outside the repository'))).toBe(true);
      });

      it('should reject path traversal attempts', () => {
        const config: RootConfig = {
          linkFiles: [{ id: 'test', name: 'Test', path: '../../etc/passwd' }],
        };

        const result = validateRootConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('outside the repository'))).toBe(true);
      });
    });
  });

  describe('validateLinksConfig', () => {
    describe('Structure Validation', () => {
      it('should accept valid links config', () => {
        const watchFile = path.join(tempDir, 'watch.md');
        const targetFile = path.join(tempDir, 'target.md');
        fs.writeFileSync(watchFile, '');
        fs.writeFileSync(targetFile, '');

        const config: FileLinkConfigArray = [
          {
            id: 'test',
            name: 'Test Link',
            watch: [path.relative(tempDir, watchFile)],
            target: [path.relative(tempDir, targetFile)],
          },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject non-array config', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = {} as any;
        const result = validateLinksConfig(config, tempDir);

        expect(result.valid).toBe(false);
        expect(result.errors[0].message).toContain('must be an array');
      });

      it('should warn about empty array', () => {
        const config: FileLinkConfigArray = [];
        const result = validateLinksConfig(config, tempDir);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain('No links configured');
      });
    });

    describe('Required Properties', () => {
      it('should reject link without watch property', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: FileLinkConfigArray = [{ target: ['file.md'] } as any];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"watch" array'))).toBe(true);
      });

      it('should reject link without target property', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: FileLinkConfigArray = [{ watch: ['file.md'] } as any];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"target" array'))).toBe(true);
      });

      it('should reject link with empty watch array', () => {
        const config: FileLinkConfigArray = [{ watch: [], target: ['file.md'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot be empty'))).toBe(true);
      });

      it('should reject link with empty target array', () => {
        const config: FileLinkConfigArray = [{ watch: ['file.md'], target: [] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot be empty'))).toBe(true);
      });
    });

    describe('WatchType Validation', () => {
      it('should accept valid watchType values', () => {
        const validTypes = ['uncommitted', 'unstaged', 'staged'] as const;

        validTypes.forEach((watchType) => {
          const config: FileLinkConfigArray = [{ watch: ['*.md'], target: ['*.txt'], watchType }];

          const result = validateLinksConfig(config, tempDir);
          expect(result.errors.some((e) => e.message.includes('Invalid watchType'))).toBe(false);
        });
      });

      it('should reject invalid watchType', () => {
        const config: FileLinkConfigArray = [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { watch: ['*.md'], target: ['*.txt'], watchType: 'invalid' as any },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('Invalid watchType'))).toBe(true);
      });
    });

    describe('Duplicate Detection', () => {
      it('should detect duplicate IDs', () => {
        const config: FileLinkConfigArray = [
          { id: 'test', watch: ['file1.md'], target: ['target1.md'] },
          { id: 'test', watch: ['file2.md'], target: ['target2.md'] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('Duplicate link ID'))).toBe(true);
      });

      it('should warn about duplicate link configurations', () => {
        const config: FileLinkConfigArray = [
          { watch: ['file.md'], target: ['target.md'], watchType: 'uncommitted' },
          { watch: ['file.md'], target: ['target.md'], watchType: 'uncommitted' },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.warnings.some((w) => w.message.includes('Duplicate link'))).toBe(true);
      });
    });

    describe('Watch and Target Same File Validation', () => {
      it('should reject when watch and target point to same file', () => {
        const config: FileLinkConfigArray = [{ watch: ['file.md'], target: ['file.md'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot point to the same file'))).toBe(
          true
        );
      });

      it('should reject when watch and target have overlapping files', () => {
        const config: FileLinkConfigArray = [
          { watch: ['file1.md', 'file2.md'], target: ['file2.md', 'file3.md'] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot point to the same file'))).toBe(
          true
        );
      });

      it('should accept when watch and target point to different files', () => {
        const watchFile = path.join(tempDir, 'watch.md');
        const targetFile = path.join(tempDir, 'target.md');
        fs.writeFileSync(watchFile, '');
        fs.writeFileSync(targetFile, '');

        const config: FileLinkConfigArray = [
          {
            watch: [path.relative(tempDir, watchFile)],
            target: [path.relative(tempDir, targetFile)],
          },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.errors.some((e) => e.message.includes('cannot point to the same file'))).toBe(
          false
        );
      });
    });

    describe('File Existence Validation', () => {
      it('should warn when watch file does not exist (non-glob)', () => {
        const config: FileLinkConfigArray = [{ watch: ['nonexistent.md'], target: ['*.txt'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.warnings.some((w) => w.message.includes('does not exist'))).toBe(true);
      });

      it('should not warn for glob patterns', () => {
        const config: FileLinkConfigArray = [{ watch: ['**/*.md'], target: ['**/*.txt'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(
          result.warnings.some(
            (w) => w.message.includes('does not exist') && w.context?.includes('watch')
          )
        ).toBe(false);
      });

      it('should reject when watch path is a directory', () => {
        const testDir = path.join(tempDir, 'testdir');
        fs.mkdirSync(testDir);

        const config: FileLinkConfigArray = [
          { watch: [path.relative(tempDir, testDir)], target: ['*.txt'] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('directory, not a file'))).toBe(true);
      });

      it('should reject when target path is a directory', () => {
        const testDir = path.join(tempDir, 'testdir');
        fs.mkdirSync(testDir);

        const config: FileLinkConfigArray = [
          { watch: ['*.md'], target: [path.relative(tempDir, testDir)] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('directory, not a file'))).toBe(true);
      });
    });

    describe('Type Validation', () => {
      it('should reject non-string watch patterns', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: FileLinkConfigArray = [{ watch: [123] as any, target: ['file.md'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('must be a string'))).toBe(true);
      });

      it('should reject non-string target patterns', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: FileLinkConfigArray = [{ watch: ['file.md'], target: [null] as any }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('must be a string'))).toBe(true);
      });
    });

    describe('Path Normalization', () => {
      it('should normalize paths when checking for duplicates', () => {
        const config: FileLinkConfigArray = [{ watch: ['./file.md'], target: ['file.md'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot point to the same file'))).toBe(
          true
        );
      });

      it('should handle paths with different separators', () => {
        const config: FileLinkConfigArray = [{ watch: ['dir/file.md'], target: ['dir/file.md'] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot point to the same file'))).toBe(
          true
        );
      });
    });

    describe('Extends Property Validation', () => {
      it('should reject link with non-string extends', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config: FileLinkConfigArray = [{ extends: 123 as any, watch: [], target: [] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"extends" must be a string'))).toBe(
          true
        );
      });

      it('should reject link with empty string extends', () => {
        const config: FileLinkConfigArray = [{ extends: '  ', watch: [], target: [] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('cannot be an empty string'))).toBe(
          true
        );
      });

      it('should reject link with extends pointing to non-existent file', () => {
        const config: FileLinkConfigArray = [
          { extends: './nonexistent.links.json', watch: [], target: [] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('does not exist'))).toBe(true);
      });

      it('should reject link with extends pointing to directory', () => {
        const testDir = path.join(tempDir, 'testdir');
        fs.mkdirSync(testDir);

        const config: FileLinkConfigArray = [
          { extends: path.relative(tempDir, testDir), watch: [], target: [] },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('not a file'))).toBe(true);
      });

      it('should accept valid extends property', () => {
        const extendsFile = path.join(tempDir, 'base.links.json');
        fs.writeFileSync(extendsFile, '[]');

        const config: FileLinkConfigArray = [
          { extends: path.relative(tempDir, extendsFile), watch: [], target: [] },
        ];

        const result = validateLinksConfig(config, tempDir);
        // Should not have extends-related errors
        expect(
          result.errors.some((e) => e.message.includes('"extends"') && e.type === 'error')
        ).toBe(false);
      });

      it('should warn when extends is set with watch, target, or watchType', () => {
        const extendsFile = path.join(tempDir, 'base.links.json');
        fs.writeFileSync(extendsFile, '[]');

        // Create watch and target files to avoid additional warnings
        const watchFile = path.join(tempDir, 'file.md');
        const targetFile = path.join(tempDir, 'target.md');
        fs.writeFileSync(watchFile, '');
        fs.writeFileSync(targetFile, '');

        const config: FileLinkConfigArray = [
          {
            id: 'test-extends',
            name: 'This is allowed for display',
            description: 'This is also allowed for display',
            extends: path.relative(tempDir, extendsFile),
            watch: [path.relative(tempDir, watchFile)],
            target: [path.relative(tempDir, targetFile)],
            watchType: 'staged',
          },
        ];

        const result = validateLinksConfig(config, tempDir);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toContain(
          'extends" is set but the following properties are also provided and will be ignored'
        );
        // The message should say "only id, name, description, and extends are used"
        expect(result.warnings[0].message).toContain(
          'only "id", "name", "description", and "extends" are used'
        );
        // watch, target, and watchType SHOULD be in the ignored properties list
        expect(result.warnings[0].message).toContain('watch, target, watchType');
      });

      it('should allow name and description with extends', () => {
        const extendsFile = path.join(tempDir, 'base.links.json');
        fs.writeFileSync(extendsFile, '[]');

        const config: FileLinkConfigArray = [
          {
            id: 'test-extends',
            name: 'Display Name',
            description: 'Display Description',
            extends: path.relative(tempDir, extendsFile),
          },
        ];

        const result = validateLinksConfig(config, tempDir);
        // Should have no warnings about name and description
        expect(result.warnings).toHaveLength(0);
        expect(result.valid).toBe(true);
      });

      it('should allow extends without watch and target', () => {
        const extendsFile = path.join(tempDir, 'base.links.json');
        fs.writeFileSync(extendsFile, '[]');

        const config: FileLinkConfigArray = [
          { extends: path.relative(tempDir, extendsFile), watch: [], target: [] },
        ];

        const result = validateLinksConfig(config, tempDir);
        // Should not require watch and target when extends is set
        expect(
          result.errors.some((e) => e.message.includes('"watch" array') && e.type === 'error')
        ).toBe(false);
        expect(
          result.errors.some((e) => e.message.includes('"target" array') && e.type === 'error')
        ).toBe(false);
      });

      it('should require watch and target when extends is not set', () => {
        const config: FileLinkConfigArray = [{ watch: [], target: [] }];

        const result = validateLinksConfig(config, tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.message.includes('"watch" array'))).toBe(true);
        expect(result.errors.some((e) => e.message.includes('"target" array'))).toBe(true);
      });
    });
  });

  describe('combineValidationResults', () => {
    it('should combine results with no errors or warnings', () => {
      const results = [
        { valid: true, errors: [], warnings: [] },
        { valid: true, errors: [], warnings: [] },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(true);
      expect(combined.errors).toHaveLength(0);
      expect(combined.warnings).toHaveLength(0);
    });

    it('should combine results with errors', () => {
      const results = [
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Error 1' }],
          warnings: [],
        },
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Error 2' }],
          warnings: [],
        },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
      expect(combined.errors).toHaveLength(2);
      expect(combined.errors[0].message).toBe('Error 1');
      expect(combined.errors[1].message).toBe('Error 2');
      expect(combined.warnings).toHaveLength(0);
    });

    it('should combine results with warnings', () => {
      const results = [
        {
          valid: true,
          errors: [],
          warnings: [{ type: 'warning' as const, message: 'Warning 1' }],
        },
        {
          valid: true,
          errors: [],
          warnings: [{ type: 'warning' as const, message: 'Warning 2' }],
        },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(true);
      expect(combined.errors).toHaveLength(0);
      expect(combined.warnings).toHaveLength(2);
      expect(combined.warnings[0].message).toBe('Warning 1');
      expect(combined.warnings[1].message).toBe('Warning 2');
    });

    it('should combine results with mixed errors and warnings', () => {
      const results = [
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Error 1' }],
          warnings: [{ type: 'warning' as const, message: 'Warning 1' }],
        },
        {
          valid: true,
          errors: [],
          warnings: [{ type: 'warning' as const, message: 'Warning 2' }],
        },
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Error 2' }],
          warnings: [],
        },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
      expect(combined.errors).toHaveLength(2);
      expect(combined.warnings).toHaveLength(2);
    });

    it('should mark as invalid if any result has errors', () => {
      const results = [
        { valid: true, errors: [], warnings: [] },
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Single error' }],
          warnings: [],
        },
        { valid: true, errors: [], warnings: [] },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
      expect(combined.errors).toHaveLength(1);
    });

    it('should handle empty results array', () => {
      const combined = combineValidationResults([]);

      expect(combined.valid).toBe(true);
      expect(combined.errors).toHaveLength(0);
      expect(combined.warnings).toHaveLength(0);
    });

    it('should handle single result', () => {
      const results = [
        {
          valid: false,
          errors: [{ type: 'error' as const, message: 'Error' }],
          warnings: [{ type: 'warning' as const, message: 'Warning' }],
        },
      ];

      const combined = combineValidationResults(results);

      expect(combined.valid).toBe(false);
      expect(combined.errors).toHaveLength(1);
      expect(combined.warnings).toHaveLength(1);
    });

    it('should preserve error and warning details', () => {
      const results = [
        {
          valid: false,
          errors: [
            {
              type: 'error' as const,
              message: 'Error with context',
              context: 'Additional context',
            },
          ],
          warnings: [],
        },
      ];

      const combined = combineValidationResults(results);

      expect(combined.errors[0].message).toBe('Error with context');
      expect(combined.errors[0].context).toBe('Additional context');
    });
  });
});
