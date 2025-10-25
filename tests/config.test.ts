import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../src/config';
import { FileLinkConfigArray } from '../src/types';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testDir: string;

  beforeEach(() => {
    configManager = new ConfigManager();
    testDir = path.join(__dirname, 'test-config-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration', () => {
      const config: FileLinkConfigArray = [
        {
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
          watchType: 'uncommitted',
        },
      ];

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array configuration', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = configManager.validateConfig({} as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an array');
    });

    it('should reject configuration with missing watch field', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = [
        {
          target: ['docs/README.md'],
        },
      ];

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject configuration with empty watch array', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = [
        {
          watch: [],
          target: ['docs/README.md'],
        },
      ];

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject configuration with invalid watchType', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = [
        {
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
          watchType: 'invalid',
        },
      ];

      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('saveConfig and loadConfig', () => {
    it('should save and load configuration', () => {
      const config: FileLinkConfigArray = [
        {
          id: 'test-link',
          name: 'Test Link',
          watch: ['src/**/*.ts'],
          target: ['docs/README.md'],
          watchType: 'uncommitted',
        },
      ];

      const configPath = path.join(testDir, 'filelinks.config.json');
      configManager.saveConfig(config, configPath);

      expect(fs.existsSync(configPath)).toBe(true);

      const loadedConfig = configManager.loadConfig(configPath);
      expect(loadedConfig).toEqual(config);
    });

    it('should throw error when loading non-existent config', () => {
      expect(() => {
        configManager.loadConfig(path.join(testDir, 'nonexistent.json'));
      }).toThrow();
    });

    it('should throw error when loading invalid JSON', () => {
      const configPath = path.join(testDir, 'invalid.json');
      fs.writeFileSync(configPath, '{ invalid json }', 'utf-8');

      expect(() => {
        configManager.loadConfig(configPath);
      }).toThrow('Invalid JSON');
    });
  });

  describe('findConfigFile', () => {
    it('should find link file in current directory', () => {
      const configPath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(configPath, '[]', 'utf-8');

      const found = configManager.findConfigFile(testDir);
      expect(found).toBe(configPath);
    });

    it('should return null when no link file exists', () => {
      const found = configManager.findConfigFile(testDir);
      expect(found).toBeNull();
    });

    it('should find link file in parent directory', () => {
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir, { recursive: true });

      const configPath = path.join(testDir, 'filelinks.links.json');
      fs.writeFileSync(configPath, '[]', 'utf-8');

      const found = configManager.findConfigFile(subDir);
      expect(found).toBe(configPath);
    });
  });

  describe('createConfig', () => {
    it('should create a new config file', () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const configPath = configManager.createConfig([]);
        expect(fs.existsSync(configPath)).toBe(true);

        const content = fs.readFileSync(configPath, 'utf-8');
        expect(JSON.parse(content)).toEqual([]);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should throw error if config already exists', () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        configManager.createConfig([]);
        expect(() => {
          configManager.createConfig([]);
        }).toThrow('already exists');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
