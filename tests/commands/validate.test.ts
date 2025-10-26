import * as fs from 'fs';
import * as path from 'path';
import { validateCommand } from '../../src/commands/validate';
import { ROOT_CONFIG_FILE_NAME } from '../../src/constants';
import * as git from '../../src/utils/git';
import { validateRootConfig, validateLinksConfig } from '../../src/utils/validation';
import { validateLinkFilePath } from '../../src/utils/linkFileValidation';
import { parseRootConfig } from '../../src/utils/rootConfig';
import { validateLinkFiles } from '../../src/utils/linkFileLoader';

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
  displayHeader: jest.fn(),
  displayFilePath: jest.fn(),
  displaySuccess: jest.fn(),
  displayError: jest.fn(),
  displayDim: jest.fn(),
  displayWarning: jest.fn(),
  displayIssues: jest.fn(),
  displayBlankLine: jest.fn(),
  displayGitRepoRequired: jest.fn(),
  displayGitRootNotFound: jest.fn(),
  displayNotAtGitRoot: jest.fn(),
}));

// Mock git utilities
jest.mock('../../src/utils/git');

// Mock validation utilities
jest.mock('../../src/utils/validation', () => ({
  validateRootConfig: jest.fn(),
  validateLinksConfig: jest.fn(),
}));

// Mock linkFileValidation utilities
jest.mock('../../src/utils/linkFileValidation', () => ({
  validateLinkFilePath: jest.fn(),
}));

// Mock rootConfig utilities
jest.mock('../../src/utils/rootConfig', () => ({
  parseRootConfig: jest.fn(),
}));

// Mock linkFileLoader utilities
jest.mock('../../src/utils/linkFileLoader', () => ({
  validateLinkFiles: jest.fn(),
}));

describe('Validate Command', () => {
  let testDir: string;
  let originalCwd: string;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Create a unique test directory for each test
    testDir = path.join(__dirname, 'test-validate-' + Date.now());
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

    // Mock validation utilities - default to valid
    (validateRootConfig as jest.Mock).mockReturnValue({ errors: [], warnings: [] });
    (validateLinksConfig as jest.Mock).mockReturnValue({ errors: [], warnings: [] });
    (validateLinkFilePath as jest.Mock).mockReturnValue({ valid: true });
    (parseRootConfig as jest.Mock).mockReturnValue({ linkFiles: [] });
    (validateLinkFiles as jest.Mock).mockResolvedValue({ hasErrors: false });
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

  describe('validateCommand with root config', () => {
    it('should validate a valid root config successfully', async () => {
      const rootConfigContent = `export default { linkFiles: [] };`;
      fs.writeFileSync(path.join(testDir, ROOT_CONFIG_FILE_NAME), rootConfigContent, 'utf-8');

      await validateCommand();

      expect(validateRootConfig).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should fail when root config has validation errors', async () => {
      const rootConfigContent = `export default { linkFiles: [] };`;
      fs.writeFileSync(path.join(testDir, ROOT_CONFIG_FILE_NAME), rootConfigContent, 'utf-8');

      (validateRootConfig as jest.Mock).mockReturnValue({
        errors: [{ message: 'Duplicate ID' }],
        warnings: [],
      });

      await expect(validateCommand()).rejects.toThrow('process.exit called with 1');
    });

    it('should validate link files when root config exists', async () => {
      const rootConfigContent = `export default { linkFiles: [{ id: 'test', name: 'Test', path: './test.json' }] };`;
      fs.writeFileSync(path.join(testDir, ROOT_CONFIG_FILE_NAME), rootConfigContent, 'utf-8');

      (parseRootConfig as jest.Mock).mockReturnValue({
        linkFiles: [{ id: 'test', name: 'Test', path: './test.json' }],
      });

      await validateCommand();

      expect(validateLinkFiles).toHaveBeenCalled();
    });

    it('should support --root flag to validate only root config', async () => {
      const rootConfigContent = `export default { linkFiles: [] };`;
      fs.writeFileSync(path.join(testDir, ROOT_CONFIG_FILE_NAME), rootConfigContent, 'utf-8');

      await validateCommand(undefined, { root: true });

      expect(validateRootConfig).toHaveBeenCalled();
      expect(validateLinkFiles).not.toHaveBeenCalled();
    });
  });

  describe('validateCommand with specific file', () => {
    it('should validate a specific link file', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      await validateCommand(linkFilePath);

      expect(validateLinkFilePath).toHaveBeenCalled();
      expect(validateLinksConfig).toHaveBeenCalled();
    });

    it('should fail when specific file has validation errors', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      (validateLinksConfig as jest.Mock).mockReturnValue({
        errors: [{ message: 'Invalid link' }],
        warnings: [],
      });

      await expect(validateCommand(linkFilePath)).rejects.toThrow('process.exit called with 1');
    });

    it('should fail when specific file path is invalid', async () => {
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      (validateLinkFilePath as jest.Mock).mockReturnValue({
        valid: false,
        error: 'Invalid file',
      });

      await expect(validateCommand(linkFilePath)).rejects.toThrow('process.exit called with 1');
    });
  });

  describe('validateCommand without root config', () => {
    it('should validate local link file when no root config exists', async () => {
      // No root config file
      const linkFilePath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(linkFilePath, JSON.stringify([]), 'utf-8');

      await validateCommand();

      expect(validateLinksConfig).toHaveBeenCalled();
    });

    it('should fail when --root flag is set but no root config exists', async () => {
      await expect(validateCommand(undefined, { root: true })).rejects.toThrow(
        'process.exit called with 1'
      );
    });

    it('should fail when no config files exist at all', async () => {
      await expect(validateCommand()).rejects.toThrow('process.exit called with 1');
    });
  });

  describe('validateCommand integration', () => {
    it('should require git repository', async () => {
      (git.isInGitRepo as jest.Mock).mockReturnValue(false);

      await expect(validateCommand()).rejects.toThrow('process.exit called with 1');
    });

    it('should show warnings without failing', async () => {
      const rootConfigContent = `export default { linkFiles: [] };`;
      fs.writeFileSync(path.join(testDir, ROOT_CONFIG_FILE_NAME), rootConfigContent, 'utf-8');

      (validateRootConfig as jest.Mock).mockReturnValue({
        errors: [],
        warnings: [{ message: 'Missing description' }],
      });

      await validateCommand();

      expect(mockExit).not.toHaveBeenCalled();
    });
  });
});
