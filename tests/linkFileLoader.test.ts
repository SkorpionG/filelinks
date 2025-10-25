import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadLinkFiles, validateLinkFiles } from '../src/utils/linkFileLoader';
import { ROOT_CONFIG_FILE_NAME } from '../src/constants';
import type { FileLinkConfigArray } from '../src/types';

// Mock chalk to avoid console output during tests
jest.mock('chalk', () => ({
  red: jest.fn((str) => str),
  green: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  dim: jest.fn((str) => str),
  bold: jest.fn((str) => str),
}));

describe('Link File Loader', () => {
  let testDir: string;
  let gitRoot: string;

  beforeEach(() => {
    // Create temporary test directory structure
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filelinks-loader-test-'));
    gitRoot = path.join(testDir, 'repo');
    fs.mkdirSync(gitRoot);
    fs.mkdirSync(path.join(gitRoot, 'module1'));
    fs.mkdirSync(path.join(gitRoot, 'module2'));

    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('loadLinkFiles', () => {
    describe('without root config', () => {
      it('should return empty array when no link file exists', async () => {
        const result = await loadLinkFiles(gitRoot);
        expect(result).toEqual([]);
      });

      it('should load local link file when it exists', async () => {
        const linkFile = path.join(gitRoot, 'filelinks.links.json');
        const config: FileLinkConfigArray = [
          {
            watch: ['src/index.ts'],
            target: ['dist/index.js'],
          },
        ];
        fs.writeFileSync(linkFile, JSON.stringify(config, null, 2));

        const result = await loadLinkFiles(gitRoot);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('local');
        expect(result[0].name).toBe('filelinks.links.json');
        expect(result[0].links).toEqual(config);
      });

      it('should exit when --id is used without root config', async () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
          throw new Error('process.exit');
        });

        await expect(loadLinkFiles(gitRoot, { id: 'test' })).rejects.toThrow('process.exit');

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
      });
    });

    describe('with root config', () => {
      it('should load link files from root config', async () => {
        // Create root config
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' },
              { id: 'module2', name: 'Module 2', path: 'module2/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        // Create link files
        const config1: FileLinkConfigArray = [{ watch: ['src/a.ts'], target: ['dist/a.js'] }];
        const config2: FileLinkConfigArray = [{ watch: ['src/b.ts'], target: ['dist/b.js'] }];
        fs.writeFileSync(
          path.join(gitRoot, 'module1', 'filelinks.links.json'),
          JSON.stringify(config1, null, 2)
        );
        fs.writeFileSync(
          path.join(gitRoot, 'module2', 'filelinks.links.json'),
          JSON.stringify(config2, null, 2)
        );

        const result = await loadLinkFiles(gitRoot);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('module1');
        expect(result[0].name).toBe('Module 1');
        expect(result[0].links).toEqual(config1);
        expect(result[1].id).toBe('module2');
        expect(result[1].name).toBe('Module 2');
        expect(result[1].links).toEqual(config2);
      });

      it('should filter by ID when specified', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' },
              { id: 'module2', name: 'Module 2', path: 'module2/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const config1: FileLinkConfigArray = [{ watch: ['src/a.ts'], target: ['dist/a.js'] }];
        fs.writeFileSync(
          path.join(gitRoot, 'module1', 'filelinks.links.json'),
          JSON.stringify(config1, null, 2)
        );

        const result = await loadLinkFiles(gitRoot, { id: 'module1' });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('module1');
      });

      it('should exit when specified ID not found (default behavior)', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
          throw new Error('process.exit');
        });

        await expect(loadLinkFiles(gitRoot, { id: 'nonexistent' })).rejects.toThrow('process.exit');

        expect(mockExit).toHaveBeenCalledWith(1);
        mockExit.mockRestore();
      });

      it('should return empty array when ID not found and exitOnMissingId is false', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const result = await loadLinkFiles(gitRoot, { id: 'nonexistent', exitOnMissingId: false });

        expect(result).toEqual([]);
      });
    });

    describe('security and validation', () => {
      it('should skip link file outside repository', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'outside', name: 'Outside', path: '../outside/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const result = await loadLinkFiles(gitRoot);

        expect(result).toEqual([]);
      });

      it('should skip duplicate link file paths', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' },
              { id: 'duplicate', name: 'Duplicate', path: 'module1/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const config: FileLinkConfigArray = [{ watch: ['src/a.ts'], target: ['dist/a.js'] }];
        fs.writeFileSync(
          path.join(gitRoot, 'module1', 'filelinks.links.json'),
          JSON.stringify(config, null, 2)
        );

        const result = await loadLinkFiles(gitRoot);

        // Only the first one should be loaded
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('module1');
      });

      it('should skip missing link files', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'missing', name: 'Missing', path: 'missing/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const result = await loadLinkFiles(gitRoot);

        expect(result).toEqual([]);
      });

      it('should filter invalid links by default', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        // Config with both valid and invalid links
        const config = [
          { watch: ['src/a.ts'], target: ['dist/a.js'] }, // valid
          { watch: [], target: ['dist/b.js'] }, // invalid - empty watch array
        ] as FileLinkConfigArray;
        fs.writeFileSync(
          path.join(gitRoot, 'module1', 'filelinks.links.json'),
          JSON.stringify(config, null, 2)
        );

        const result = await loadLinkFiles(gitRoot);

        // Should only include valid link
        expect(result).toHaveLength(1);
        expect(result[0].links).toHaveLength(1);
        expect(result[0].links[0].watch).toEqual(['src/a.ts']);
      });

      it('should include all links when filterInvalidLinks is false', async () => {
        const rootConfig = `
          export default {
            linkFiles: [
              { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' }
            ]
          };
        `;
        fs.writeFileSync(path.join(gitRoot, ROOT_CONFIG_FILE_NAME), rootConfig);

        const config = [
          { watch: ['src/a.ts'], target: ['dist/a.js'] },
          { watch: [], target: ['dist/b.js'] },
        ] as FileLinkConfigArray;
        fs.writeFileSync(
          path.join(gitRoot, 'module1', 'filelinks.links.json'),
          JSON.stringify(config, null, 2)
        );

        const result = await loadLinkFiles(gitRoot, { filterInvalidLinks: false });

        // Should include all links
        expect(result).toHaveLength(1);
        expect(result[0].links).toHaveLength(2);
      });
    });
  });

  describe('validateLinkFiles', () => {
    it('should validate link files and return error status', async () => {
      const rootConfig = {
        linkFiles: [{ id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' }],
      };

      const config: FileLinkConfigArray = [{ watch: ['src/a.ts'], target: ['dist/a.js'] }];
      fs.writeFileSync(
        path.join(gitRoot, 'module1', 'filelinks.links.json'),
        JSON.stringify(config, null, 2)
      );

      const result = await validateLinkFiles(rootConfig, gitRoot);

      expect(result.hasErrors).toBe(false);
      expect(result.processedCount).toBe(1);
    });

    it('should detect errors in link files', async () => {
      const rootConfig = {
        linkFiles: [{ id: 'missing', name: 'Missing', path: 'missing/filelinks.links.json' }],
      };

      const result = await validateLinkFiles(rootConfig, gitRoot);

      expect(result.hasErrors).toBe(true);
      expect(result.processedCount).toBe(0);
    });

    it('should skip duplicate paths during validation', async () => {
      const rootConfig = {
        linkFiles: [
          { id: 'module1', name: 'Module 1', path: 'module1/filelinks.links.json' },
          { id: 'duplicate', name: 'Duplicate', path: 'module1/filelinks.links.json' },
        ],
      };

      const config: FileLinkConfigArray = [{ watch: ['src/a.ts'], target: ['dist/a.js'] }];
      fs.writeFileSync(
        path.join(gitRoot, 'module1', 'filelinks.links.json'),
        JSON.stringify(config, null, 2)
      );

      const result = await validateLinkFiles(rootConfig, gitRoot);

      // Should process only once
      expect(result.processedCount).toBe(1);
    });

    it('should detect security violations', async () => {
      const rootConfig = {
        linkFiles: [{ id: 'outside', name: 'Outside', path: '../outside/filelinks.links.json' }],
      };

      const result = await validateLinkFiles(rootConfig, gitRoot);

      expect(result.hasErrors).toBe(true);
      expect(result.processedCount).toBe(0);
    });
  });
});
