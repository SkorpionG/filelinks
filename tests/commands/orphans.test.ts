import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as gitUtils from '../../src/utils/git';

// Mock chalk to avoid ESM import issues in Jest
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (str: string) => str,
    dim: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
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
import { orphansCommand } from '../../src/commands/orphans';
import {
  displayCommandHeader,
  displayWarning,
  displaySuccess,
  displayDim,
} from '../../src/utils/ui';

describe('Orphans Command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original working directory
    originalCwd = process.cwd();

    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-orphans-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });

    // Initialize a git repository in the test directory
    process.chdir(testDir);
    execSync('git init', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'ignore' });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic functionality', () => {
    it('should find no orphans when no link files exist', async () => {
      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith(
        expect.stringContaining('No link files found in repository')
      );
    });

    it('should find no orphans when all files are in root config', async () => {
      // Create a root config
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'root',
              name: 'Root Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create the link file
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');

      await orphansCommand({});

      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });

    it('should find orphaned files not in root config', async () => {
      // Create a root config with one file
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'src',
              name: 'Src Links',
              path: './src/filelinks.links.json',
            },
          ],
        };
      `;
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');
      fs.writeFileSync(
        path.join(testDir, 'src', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      // Create an orphaned file
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');

      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith(expect.stringContaining('1 orphaned'));
    });

    it('should find multiple orphaned files', async () => {
      // Create a root config with one file
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'src',
              name: 'Src Links',
              path: './src/filelinks.links.json',
            },
          ],
        };
      `;
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'lib'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'test'), { recursive: true });

      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');
      fs.writeFileSync(
        path.join(testDir, 'src', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      // Create orphaned files
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');
      fs.writeFileSync(
        path.join(testDir, 'lib', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(testDir, 'test', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith(expect.stringContaining('3 orphaned'));
    });
  });

  describe('Extends field detection', () => {
    it('should not mark files as orphaned if they are referenced via extends', async () => {
      // Create a root config with one file
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create main link file that extends another
      const mainLinks = [
        {
          extends: './shared/filelinks.links.json',
        },
      ];
      fs.writeFileSync(
        path.join(testDir, 'filelinks.links.json'),
        JSON.stringify(mainLinks),
        'utf-8'
      );

      // Create the extended file
      fs.mkdirSync(path.join(testDir, 'shared'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'shared', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });

    it('should handle multiple extends references', async () => {
      // Create a root config with one file
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create main link file that extends multiple files
      const mainLinks = [
        {
          extends: './shared1/filelinks.links.json',
        },
        {
          extends: './shared2/filelinks.links.json',
        },
      ];
      fs.writeFileSync(
        path.join(testDir, 'filelinks.links.json'),
        JSON.stringify(mainLinks),
        'utf-8'
      );

      // Create the extended files
      fs.mkdirSync(path.join(testDir, 'shared1'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'shared2'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'shared1', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(testDir, 'shared2', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });

    it('should not include broken extends references in referenced set', async () => {
      // Create a root config with one file
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create main link file that extends a non-existent file
      const mainLinks = [
        {
          extends: './nonexistent/filelinks.links.json',
        },
      ];
      fs.writeFileSync(
        path.join(testDir, 'filelinks.links.json'),
        JSON.stringify(mainLinks),
        'utf-8'
      );

      await orphansCommand({});

      // Should still show success since only the main file exists
      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });
  });

  describe('Mixed scenarios', () => {
    it('should correctly identify orphans with mix of root config and extends', async () => {
      // Create a root config with some files
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
            {
              id: 'src',
              name: 'Src Links',
              path: './src/filelinks.links.json',
            },
          ],
        };
      `;
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'shared'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'orphan'), { recursive: true });

      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Main file extends shared
      const mainLinks = [
        {
          extends: './shared/filelinks.links.json',
        },
      ];
      fs.writeFileSync(
        path.join(testDir, 'filelinks.links.json'),
        JSON.stringify(mainLinks),
        'utf-8'
      );

      // Create src file (in config)
      fs.writeFileSync(
        path.join(testDir, 'src', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      // Create shared file (referenced by extends)
      fs.writeFileSync(
        path.join(testDir, 'shared', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      // Create orphan file (not in config, not in extends)
      fs.writeFileSync(
        path.join(testDir, 'orphan', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith(expect.stringContaining('1 orphaned'));
    });
  });

  describe('Verbose mode', () => {
    it('should show additional details in verbose mode', async () => {
      // Create a root config
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'src',
              name: 'Src Links',
              path: './src/filelinks.links.json',
            },
          ],
        };
      `;
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');
      fs.writeFileSync(
        path.join(testDir, 'src', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      // Create an orphaned file
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');

      // Spy on console.log to check verbose output
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await orphansCommand({ verbose: true });

      expect(displayWarning).toHaveBeenCalledWith(expect.stringContaining('1 orphaned'));

      // Check that verbose info was logged
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('not in config'));

      consoleLogSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON in link files gracefully', async () => {
      // Create a root config
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create main file with invalid JSON
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), 'invalid json', 'utf-8');

      // Create orphan with invalid JSON
      fs.writeFileSync(path.join(testDir, 'orphan.links.json'), 'invalid', 'utf-8');

      await orphansCommand({});

      // Should still run without crashing
      expect(displayCommandHeader).toHaveBeenCalled();
    });

    it('should handle missing root config gracefully', async () => {
      // Create link files without root config
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');

      await orphansCommand({});

      // Should report the file as orphaned (no root config to reference it)
      expect(displayWarning).toHaveBeenCalledWith(expect.stringContaining('1 orphaned'));
    });

    it('should handle unparseable root config gracefully', async () => {
      // Create invalid root config
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), 'invalid typescript', 'utf-8');

      // Create link file
      fs.writeFileSync(path.join(testDir, 'filelinks.links.json'), JSON.stringify([]), 'utf-8');

      await orphansCommand({});

      // Should still find the link file
      expect(displayDim).toHaveBeenCalledWith(expect.stringContaining('1 total link file'));
    });
  });

  describe('Path normalization', () => {
    it('should handle different path formats correctly', async () => {
      // Create a root config with forward slashes
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'src',
              name: 'Src Links',
              path: './src/filelinks.links.json',
            },
          ],
        };
      `;
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create the file (path will be normalized by the system)
      fs.writeFileSync(
        path.join(testDir, 'src', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });

    it('should handle relative paths in extends correctly', async () => {
      // Create a root config
      const rootConfig = `
        export default {
          linkFiles: [
            {
              id: 'main',
              name: 'Main Links',
              path: './filelinks.links.json',
            },
          ],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      // Create main file with relative extends
      const mainLinks = [
        {
          extends: './shared/filelinks.links.json',
        },
      ];
      fs.writeFileSync(
        path.join(testDir, 'filelinks.links.json'),
        JSON.stringify(mainLinks),
        'utf-8'
      );

      // Create shared file
      fs.mkdirSync(path.join(testDir, 'shared'), { recursive: true });
      fs.writeFileSync(
        path.join(testDir, 'shared', 'filelinks.links.json'),
        JSON.stringify([]),
        'utf-8'
      );

      await orphansCommand({});

      expect(displaySuccess).toHaveBeenCalledWith(
        expect.stringContaining('No orphaned link files found')
      );
    });
  });

  describe('Non-git repository', () => {
    it('should warn when not in a git repository', async () => {
      // Mock git utilities to simulate non-git environment
      jest.spyOn(gitUtils, 'isInGitRepo').mockReturnValue(false);

      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith('Not in a git repository.');

      // Restore original implementation
      jest.spyOn(gitUtils, 'isInGitRepo').mockRestore();
    });
  });

  describe('Empty repository scenarios', () => {
    it('should handle repository with only root config and no link files', async () => {
      // Create empty root config
      const rootConfig = `
        export default {
          linkFiles: [],
        };
      `;
      fs.writeFileSync(path.join(testDir, 'filelinks.config.ts'), rootConfig, 'utf-8');

      await orphansCommand({});

      expect(displayWarning).toHaveBeenCalledWith(
        expect.stringContaining('No link files found in repository')
      );
    });
  });
});
