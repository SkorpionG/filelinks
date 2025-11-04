import * as fs from 'fs';
import * as path from 'path';
import { newCommand } from '../../src/commands/new';
import { DEFAULT_LINK_FILE_NAME } from '../../src/constants';
import * as git from '../../src/utils/git';
import * as rootConfig from '../../src/utils/rootConfig';

// Mock inquirer
const mockPrompt = jest.fn();
jest.mock('inquirer', () => {
  return {
    __esModule: true,
    default: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prompt: (...args: any[]) => mockPrompt(...args),
    },
  };
});

// Mock chalk
jest.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    dim: (str: string) => str,
    yellow: (str: string) => str,
    green: (str: string) => str,
    bold: (str: string) => str,
  },
}));

// Mock UI module
jest.mock('../../src/utils/ui', () => ({
  displayCommandHeader: jest.fn(),
  displayWarning: jest.fn(),
  displaySuccess: jest.fn(),
  displayHeader: jest.fn(),
  displayDim: jest.fn(),
  displayInstructionList: jest.fn(),
}));

// Mock git utilities
jest.mock('../../src/utils/git');

// Mock rootConfig utilities
jest.mock('../../src/utils/rootConfig', () => ({
  findRootConfigFile: jest.fn(),
  addLinkFileToRootConfig: jest.fn(),
  createLinkFileReference: jest.fn(() => ({
    id: 'test-id',
    name: 'Test Name',
    path: './filelinks.links.json',
  })),
}));

describe('New Command', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-new-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);

    // Mock git utilities
    (git.isInGitRepo as jest.Mock).mockReturnValue(true);
    (git.findGitRoot as jest.Mock).mockReturnValue(testDir);

    // Reset mocks
    mockPrompt.mockReset();
  });

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('newCommand with --empty flag', () => {
    it('should create an empty link file', async () => {
      await newCommand({ empty: true });

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));
      expect(content).toEqual([]);
    });

    it('should not prompt user when --empty flag is set', async () => {
      await newCommand({ empty: true });

      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should create link file with correct name', async () => {
      await newCommand({ empty: true });

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);
      expect(path.basename(linkFilePath)).toBe('filelinks.links.json');
    });
  });

  describe('newCommand without --empty flag', () => {
    it('should prompt user if they want to add a link', async () => {
      mockPrompt.mockResolvedValueOnce({ addLink: false });

      await newCommand({});

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'addLink',
            message: 'Would you like to add a file link now?',
          }),
        ])
      );
    });

    it('should create empty link file when user declines to add links', async () => {
      mockPrompt.mockResolvedValueOnce({ addLink: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));
      expect(content).toEqual([]);
    });

    it('should prompt for link details when user wants to add a link', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Test Link',
          description: 'Test description',
          watch: 'src/*.ts',
          target: 'docs/*.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });

    it('should create link file with one link when user adds one', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'API Changes',
          description: 'Keep docs in sync with API',
          watch: 'src/api/*.ts',
          target: 'docs/api.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        name: 'API Changes',
        description: 'Keep docs in sync with API',
        watch: ['src/api/*.ts'],
        target: ['docs/api.md'],
        watchType: 'uncommitted',
      });
    });

    it('should handle comma-separated watch patterns', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Multiple Patterns',
          description: '',
          watch: 'src/*.ts, test/*.test.ts, package.json',
          target: 'README.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content[0].watch).toEqual(['src/*.ts', 'test/*.test.ts', 'package.json']);
    });

    it('should handle comma-separated target patterns', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Multiple Targets',
          description: '',
          watch: 'src/*.ts',
          target: 'README.md, docs/guide.md, CHANGELOG.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content[0].target).toEqual(['README.md', 'docs/guide.md', 'CHANGELOG.md']);
    });

    it('should support all watchType options', async () => {
      const watchTypes: Array<'uncommitted' | 'unstaged' | 'staged'> = [
        'uncommitted',
        'unstaged',
        'staged',
      ];

      for (const watchType of watchTypes) {
        // Clean up previous test
        const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
        if (fs.existsSync(linkFilePath)) {
          fs.unlinkSync(linkFilePath);
        }

        mockPrompt
          .mockResolvedValueOnce({ addLink: true })
          .mockResolvedValueOnce({
            name: `Link ${watchType}`,
            description: '',
            watch: 'src/*.ts',
            target: 'docs/*.md',
            watchType,
            addId: false,
          })
          .mockResolvedValueOnce({ continueAdding: false });

        await newCommand({});

        const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));
        expect(content[0].watchType).toBe(watchType);
      }
    });

    it('should include custom ID when user provides one', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Custom ID Link',
          description: '',
          watch: 'src/*.ts',
          target: 'docs/*.md',
          watchType: 'uncommitted',
          addId: true,
          id: 'my-custom-id',
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content[0].id).toBe('my-custom-id');
    });

    it('should allow adding multiple links', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Link 1',
          description: '',
          watch: 'src/*.ts',
          target: 'docs/*.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: true })
        .mockResolvedValueOnce({
          name: 'Link 2',
          description: '',
          watch: 'test/*.ts',
          target: 'README.md',
          watchType: 'staged',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content).toHaveLength(2);
      expect(content[0].name).toBe('Link 1');
      expect(content[1].name).toBe('Link 2');
    });

    it('should not include optional fields when not provided', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: '',
          description: '',
          watch: 'src/*.ts',
          target: 'docs/*.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content[0]).not.toHaveProperty('name');
      expect(content[0]).not.toHaveProperty('description');
      expect(content[0]).not.toHaveProperty('id');
    });
  });

  describe('newCommand with --force flag', () => {
    it('should overwrite existing link file', async () => {
      // Create an existing file
      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      fs.writeFileSync(
        linkFilePath,
        JSON.stringify([{ watch: ['old.ts'], target: ['old.md'], watchType: 'uncommitted' }]),
        'utf-8'
      );

      await newCommand({ force: true, empty: true });

      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));
      expect(content).toEqual([]);
    });

    it('should not prompt when force flag is set with empty flag', async () => {
      // Create an existing file
      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      await newCommand({ force: true, empty: true });

      expect(mockPrompt).not.toHaveBeenCalled();
    });
  });

  describe('newCommand without --force flag', () => {
    it('should not overwrite existing link file', async () => {
      // Create an existing file
      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const existingContent = [
        { watch: ['existing.ts'], target: ['existing.md'], watchType: 'uncommitted' as const },
      ];
      fs.writeFileSync(linkFilePath, JSON.stringify(existingContent), 'utf-8');

      await newCommand({ empty: true });

      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));
      expect(content).toEqual(existingContent);
    });
  });

  describe('newCommand in non-git repository', () => {
    it('should still create link file with warning when not in git repo', async () => {
      (git.isInGitRepo as jest.Mock).mockReturnValue(false);
      (git.findGitRoot as jest.Mock).mockReturnValue(null);

      await newCommand({ empty: true });

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);
    });
  });

  describe('newCommand file format', () => {
    it('should create properly formatted JSON with 2-space indentation', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: 'Test',
          description: '',
          watch: 'src/*.ts',
          target: 'docs/*.md',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = fs.readFileSync(linkFilePath, 'utf-8');

      // Check for 2-space indentation
      expect(content).toContain('  {');
      expect(content).toContain('    "name"');
    });

    it('should end file with newline', async () => {
      await newCommand({ empty: true });

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = fs.readFileSync(linkFilePath, 'utf-8');

      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('newCommand validation', () => {
    it('should trim whitespace from comma-separated values', async () => {
      mockPrompt
        .mockResolvedValueOnce({ addLink: true })
        .mockResolvedValueOnce({
          name: '',
          description: '',
          watch: '  src/*.ts  ,  test/*.ts  ',
          target: '  docs/*.md  ,  README.md  ',
          watchType: 'uncommitted',
          addId: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await newCommand({});

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      const content = JSON.parse(fs.readFileSync(linkFilePath, 'utf-8'));

      expect(content[0].watch).toEqual(['src/*.ts', 'test/*.ts']);
      expect(content[0].target).toEqual(['docs/*.md', 'README.md']);
    });
  });

  describe('newCommand with --skip-root flag', () => {
    it('should skip adding to root config when flag is set', async () => {
      const addLinkFileToRootConfigSpy = jest.spyOn(rootConfig, 'addLinkFileToRootConfig');

      await newCommand({ empty: true, skipRoot: true });

      // Should not attempt to add to root config
      expect(addLinkFileToRootConfigSpy).not.toHaveBeenCalled();

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);
    });

    it('should prompt user when flag is not set', async () => {
      // Create a mock root config file
      const rootConfigPath = path.join(testDir, 'filelinks.config.ts');
      const rootConfigContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [],
};

export default config;
`;
      fs.writeFileSync(rootConfigPath, rootConfigContent, 'utf-8');

      // Mock findRootConfigFile to return the test config path
      jest.spyOn(rootConfig, 'findRootConfigFile').mockReturnValue(rootConfigPath);

      mockPrompt
        .mockResolvedValueOnce({ addLink: false })
        .mockResolvedValueOnce({ addToRoot: true });

      await newCommand({});

      // Should prompt for adding to root config
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'confirm',
            name: 'addToRoot',
            message: 'Add this link file to the root configuration?',
          }),
        ])
      );
    });

    it('should respect user choice to skip adding to root', async () => {
      // Create a mock root config file
      const rootConfigPath = path.join(testDir, 'filelinks.config.ts');
      const rootConfigContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [],
};

export default config;
`;
      fs.writeFileSync(rootConfigPath, rootConfigContent, 'utf-8');

      // Mock findRootConfigFile to return the test config path
      jest.spyOn(rootConfig, 'findRootConfigFile').mockReturnValue(rootConfigPath);

      const addLinkFileToRootConfigSpy = jest.spyOn(rootConfig, 'addLinkFileToRootConfig');

      mockPrompt
        .mockResolvedValueOnce({ addLink: false })
        .mockResolvedValueOnce({ addToRoot: false });

      await newCommand({});

      // Should not add to root config when user declines
      expect(addLinkFileToRootConfigSpy).not.toHaveBeenCalled();

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);
    });

    it('should add to root config when user confirms', async () => {
      // Create a mock root config file
      const rootConfigPath = path.join(testDir, 'filelinks.config.ts');
      const rootConfigContent = `import { RootConfig } from './types';

const config: RootConfig = {
  linkFiles: [],
};

export default config;
`;
      fs.writeFileSync(rootConfigPath, rootConfigContent, 'utf-8');

      // Mock findRootConfigFile to return the test config path
      jest.spyOn(rootConfig, 'findRootConfigFile').mockReturnValue(rootConfigPath);

      const addLinkFileToRootConfigSpy = jest
        .spyOn(rootConfig, 'addLinkFileToRootConfig')
        .mockReturnValue(true);

      mockPrompt
        .mockResolvedValueOnce({ addLink: false })
        .mockResolvedValueOnce({ addToRoot: true });

      await newCommand({});

      // Should add to root config when user confirms
      expect(addLinkFileToRootConfigSpy).toHaveBeenCalled();

      const linkFilePath = path.join(testDir, DEFAULT_LINK_FILE_NAME);
      expect(fs.existsSync(linkFilePath)).toBe(true);
    });
  });
});
