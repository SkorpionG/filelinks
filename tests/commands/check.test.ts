import * as fs from 'fs';
import * as path from 'path';
import { checkCommand } from '../../src/commands/check';
import * as git from '../../src/utils/git';
import * as changes from '../../src/utils/changes';

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = {
    cyan: (str: string) => str,
    dim: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    bold: (str: string) => str,
  };
  return {
    __esModule: true,
    default: mockChalk,
    ...mockChalk,
  };
});

// Mock UI module
jest.mock('../../src/utils/ui', () => ({
  displayCommandHeader: jest.fn(),
  displayWarning: jest.fn(),
  displayDim: jest.fn(),
  displayProcessing: jest.fn(),
  displayHeader: jest.fn(),
  displaySuccess: jest.fn(),
  displayFilePath: jest.fn(),
  displayError: jest.fn(),
  displayStatus: jest.fn(),
  displayBlankLine: jest.fn(),
  displayGitRepoRequired: jest.fn(),
  displayGitRootNotFound: jest.fn(),
  displayNotAtGitRoot: jest.fn(),
}));

// Mock git utilities
jest.mock('../../src/utils/git');

// Mock changes utilities
jest.mock('../../src/utils/changes');

// Mock linkFileLoader
jest.mock('../../src/utils/linkFileLoader', () => ({
  loadLinkFiles: jest.fn(),
}));

import { loadLinkFiles } from '../../src/utils/linkFileLoader';

describe('Check Command', () => {
  let testDir: string;
  let originalCwd: string;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-check-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);

    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation(((
      code?: string | number | null | undefined
    ) => {
      throw new Error(`process.exit called with ${code}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    // Mock git utilities
    (git.isInGitRepo as jest.Mock).mockReturnValue(true);
    (git.findGitRoot as jest.Mock).mockReturnValue(testDir);
    (git.isGitRoot as jest.Mock).mockReturnValue(true);

    // Mock changes utilities - default to no changes
    (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
    (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);
    (changes.getLastCommitInfo as jest.Mock).mockResolvedValue(null);

    // Mock loadLinkFiles - default to empty array
    (loadLinkFiles as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    // Restore mocks
    mockExit.mockRestore();

    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('checkCommand basic functionality', () => {
    it('should check without errors when no link files exist', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([]);

      await checkCommand({});

      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should require git repository', async () => {
      (git.isInGitRepo as jest.Mock).mockReturnValue(false);

      await expect(checkCommand({})).rejects.toThrow('process.exit called with 1');
    });

    it('should check link files when they exist', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      await checkCommand({});

      expect(loadLinkFiles).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should report when no changes are detected', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);

      await checkCommand({});

      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('checkCommand with changes', () => {
    it('should detect changes in watched files', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts', 'src/api.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts', 'src/api.ts']);

      await checkCommand({});

      expect(changes.getChangedFiles).toHaveBeenCalledWith('uncommitted', testDir);
      expect(changes.findMatchingFiles).toHaveBeenCalled();
    });

    it('should check different watchType values', async () => {
      const watchTypes: Array<'uncommitted' | 'unstaged' | 'staged'> = [
        'uncommitted',
        'unstaged',
        'staged',
      ];

      for (const watchType of watchTypes) {
        jest.clearAllMocks();

        (loadLinkFiles as jest.Mock).mockResolvedValue([
          {
            id: 'test',
            name: 'Test Links',
            path: 'filelinks.links.json',
            links: [
              {
                watch: ['src/*.ts'],
                target: ['docs/*.md'],
                watchType,
              },
            ],
          },
        ]);

        (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
        (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

        await checkCommand({});

        expect(changes.getChangedFiles).toHaveBeenCalledWith(watchType, testDir);
      }
    });

    it('should handle multiple links with different watchTypes', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
            {
              watch: ['test/*.ts'],
              target: ['README.md'],
              watchType: 'staged',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock)
        .mockResolvedValueOnce(['src/index.ts'])
        .mockResolvedValueOnce(['test/api.test.ts']);
      (changes.findMatchingFiles as jest.Mock)
        .mockReturnValueOnce(['src/index.ts'])
        .mockReturnValueOnce(['test/api.test.ts']);

      await checkCommand({});

      expect(changes.getChangedFiles).toHaveBeenCalledTimes(2);
      expect(changes.getChangedFiles).toHaveBeenCalledWith('uncommitted', testDir);
      expect(changes.getChangedFiles).toHaveBeenCalledWith('staged', testDir);
    });
  });

  describe('checkCommand with --id flag', () => {
    it('should check only specific link file by ID', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'specific',
          name: 'Specific Links',
          path: 'specific.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      await checkCommand({ id: 'specific' });

      expect(loadLinkFiles).toHaveBeenCalledWith(testDir, { id: 'specific' });
    });
  });

  describe('checkCommand with --file flag', () => {
    it('should check specific file when path is provided', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      const linkContent = [
        {
          watch: ['src/*.ts'],
          target: ['docs/*.md'],
          watchType: 'uncommitted',
        },
      ];
      fs.writeFileSync(linkFilePath, JSON.stringify(linkContent), 'utf-8');

      (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);

      await checkCommand({ file: linkFilePath });

      expect(loadLinkFiles).not.toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should fail when checking non-existent file', async () => {
      await expect(checkCommand({ file: './non-existent.json' })).rejects.toThrow(
        'process.exit called with 1'
      );
    });

    it('should detect changes in specific file', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      const linkContent = [
        {
          watch: ['src/*.ts'],
          target: ['docs/*.md'],
          watchType: 'uncommitted',
        },
      ];
      fs.writeFileSync(linkFilePath, JSON.stringify(linkContent), 'utf-8');

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

      await checkCommand({ file: linkFilePath });

      expect(changes.getChangedFiles).toHaveBeenCalledWith('uncommitted', testDir);
    });
  });

  describe('checkCommand with --verbose flag', () => {
    it('should show additional info with verbose flag', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);
      (changes.getLastCommitInfo as jest.Mock).mockResolvedValue({
        hash: 'abc123',
        message: 'feat: add feature',
        author: 'Test Author',
      });

      await checkCommand({ verbose: true });

      expect(changes.getLastCommitInfo).toHaveBeenCalled();
    });

    it('should show success message when no changes with verbose flag', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);

      await checkCommand({ verbose: true });

      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('checkCommand with multiple link files', () => {
    it('should check multiple link files', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'api',
          name: 'API Links',
          path: 'api/filelinks.links.json',
          links: [
            {
              watch: ['src/api/*.ts'],
              target: ['docs/api.md'],
              watchType: 'uncommitted',
            },
          ],
        },
        {
          id: 'ui',
          name: 'UI Links',
          path: 'ui/filelinks.links.json',
          links: [
            {
              watch: ['src/ui/*.tsx'],
              target: ['docs/ui.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);

      await checkCommand({});

      expect(loadLinkFiles).toHaveBeenCalled();
    });
  });

  describe('checkCommand deduplication', () => {
    it('should deduplicate identical links', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

      await checkCommand({});

      // Should only check once due to deduplication
      expect(changes.getChangedFiles).toHaveBeenCalledTimes(1);
    });

    it('should not deduplicate links with different watchTypes', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'staged',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

      await checkCommand({});

      // Should check both since watchTypes differ
      expect(changes.getChangedFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkCommand with link metadata', () => {
    it('should handle links with name and description', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              name: 'API Documentation',
              description: 'Keep API docs in sync with implementation',
              watch: ['src/api/*.ts'],
              target: ['docs/api.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/api/routes.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/api/routes.ts']);

      await checkCommand({});

      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle links with custom IDs', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              id: 'api-sync',
              watch: ['src/api/*.ts'],
              target: ['docs/api.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockResolvedValue([]);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue([]);

      await checkCommand({});

      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('checkCommand error handling', () => {
    it('should handle errors gracefully', async () => {
      (loadLinkFiles as jest.Mock).mockResolvedValue([
        {
          id: 'test',
          name: 'Test Links',
          path: 'filelinks.links.json',
          links: [
            {
              watch: ['src/*.ts'],
              target: ['docs/*.md'],
              watchType: 'uncommitted',
            },
          ],
        },
      ]);

      (changes.getChangedFiles as jest.Mock).mockRejectedValue(new Error('Git error'));

      await checkCommand({});

      // Should not crash, just report no changes for that link
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should handle invalid link file when using --file flag', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, 'invalid json', 'utf-8');

      await expect(checkCommand({ file: linkFilePath })).rejects.toThrow(
        'process.exit called with 1'
      );
    });
  });

  describe('checkCommand with target file status', () => {
    it('should check if target files exist', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      const linkContent = [
        {
          watch: ['src/*.ts'],
          target: ['docs/api.md'],
          watchType: 'uncommitted',
        },
      ];
      fs.writeFileSync(linkFilePath, JSON.stringify(linkContent), 'utf-8');

      // Create the target file
      const docsDir = path.join(testDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'api.md'), '', 'utf-8');

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

      await checkCommand({ file: linkFilePath });

      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should report when target files do not exist', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      const linkContent = [
        {
          watch: ['src/*.ts'],
          target: ['docs/missing.md'],
          watchType: 'uncommitted',
        },
      ];
      fs.writeFileSync(linkFilePath, JSON.stringify(linkContent), 'utf-8');

      (changes.getChangedFiles as jest.Mock).mockResolvedValue(['src/index.ts']);
      (changes.findMatchingFiles as jest.Mock).mockReturnValue(['src/index.ts']);

      await checkCommand({ file: linkFilePath });

      expect(mockExit).not.toHaveBeenCalled();
    });
  });
});
