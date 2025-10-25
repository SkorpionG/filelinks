import * as fs from 'fs';
import * as path from 'path';
import { findGitRoot, isInGitRepo, isGitRoot, getRelativePathFromGitRoot } from '../src/utils/git';

describe('Git utilities', () => {
  let testDir: string;
  let gitRepoDir: string;
  let subDir: string;

  beforeEach(() => {
    // Create test directory structure in /tmp to avoid parent git repos
    testDir = path.join('/tmp', 'filelinks-test-git-' + Date.now());
    gitRepoDir = path.join(testDir, 'repo');
    subDir = path.join(gitRepoDir, 'subdir', 'nested');

    fs.mkdirSync(subDir, { recursive: true });
    fs.mkdirSync(path.join(gitRepoDir, '.git'));
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('findGitRoot', () => {
    it('should find git root from git directory', () => {
      const result = findGitRoot(gitRepoDir);
      expect(result).toBe(gitRepoDir);
    });

    it('should find git root from subdirectory', () => {
      const result = findGitRoot(subDir);
      expect(result).toBe(gitRepoDir);
    });

    it('should return null when not in git repository', () => {
      const nonGitDir = path.join(testDir, 'non-git');
      fs.mkdirSync(nonGitDir, { recursive: true });

      const result = findGitRoot(nonGitDir);
      expect(result).toBeNull();
    });
  });

  describe('isInGitRepo', () => {
    it('should return true when in git repository', () => {
      expect(isInGitRepo(gitRepoDir)).toBe(true);
      expect(isInGitRepo(subDir)).toBe(true);
    });

    it('should return false when not in git repository', () => {
      const nonGitDir = path.join(testDir, 'non-git');
      fs.mkdirSync(nonGitDir, { recursive: true });

      expect(isInGitRepo(nonGitDir)).toBe(false);
    });
  });

  describe('isGitRoot', () => {
    it('should return true at git repository root', () => {
      expect(isGitRoot(gitRepoDir)).toBe(true);
    });

    it('should return false in subdirectory', () => {
      expect(isGitRoot(subDir)).toBe(false);
    });

    it('should return false when not in git repository', () => {
      const nonGitDir = path.join(testDir, 'non-git');
      fs.mkdirSync(nonGitDir, { recursive: true });

      expect(isGitRoot(nonGitDir)).toBe(false);
    });
  });

  describe('getRelativePathFromGitRoot', () => {
    it('should return empty string at git root', () => {
      const result = getRelativePathFromGitRoot(gitRepoDir);
      expect(result).toBe('');
    });

    it('should return relative path from subdirectory', () => {
      const result = getRelativePathFromGitRoot(subDir);
      expect(result).toBe(path.join('subdir', 'nested'));
    });

    it('should return null when not in git repository', () => {
      const nonGitDir = path.join(testDir, 'non-git');
      fs.mkdirSync(nonGitDir, { recursive: true });

      const result = getRelativePathFromGitRoot(nonGitDir);
      expect(result).toBeNull();
    });
  });
});
