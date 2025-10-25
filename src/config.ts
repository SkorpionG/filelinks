import * as fs from 'fs';
import * as path from 'path';
import { FileLinkConfigArray } from './types';
import { LINK_FILE_NAMES, DEFAULT_LINK_FILE_NAME, CLI_NAME } from './constants';

/**
 * @deprecated Use LINK_FILE_NAMES from constants instead
 */
export const CONFIG_FILE_NAMES = LINK_FILE_NAMES;

export class ConfigManager {
  private configPath: string | null = null;

  /**
   * Find the link file in the current directory or parent directories
   */
  findConfigFile(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;

    while (true) {
      for (const fileName of LINK_FILE_NAMES) {
        const filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
          return filePath;
        }
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root directory
        break;
      }
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Load link configuration from file
   */
  loadConfig(configPath?: string): FileLinkConfigArray {
    const targetPath = configPath || this.findConfigFile();

    if (!targetPath) {
      throw new Error(`No link file found. Run "${CLI_NAME} new" to create one.`);
    }

    this.configPath = targetPath;

    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      const config = JSON.parse(content);

      if (!Array.isArray(config)) {
        throw new Error('Configuration must be an array of file links');
      }

      return config as FileLinkConfigArray;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(config: FileLinkConfigArray, configPath?: string): void {
    const targetPath = configPath || this.configPath || this.getDefaultConfigPath();

    try {
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(targetPath, content + '\n', 'utf-8');
      this.configPath = targetPath;
    } catch (error) {
      throw new Error(
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the default link file path
   */
  getDefaultConfigPath(): string {
    return path.join(process.cwd(), DEFAULT_LINK_FILE_NAME);
  }

  /**
   * Check if a configuration file exists (searches upward)
   */
  configExists(): boolean {
    return this.findConfigFile() !== null;
  }

  /**
   * Check if a link file exists in the current directory only
   */
  configExistsInCurrentDir(): boolean {
    const currentDir = process.cwd();
    for (const fileName of LINK_FILE_NAMES) {
      const filePath = path.join(currentDir, fileName);
      if (fs.existsSync(filePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find link file in the current directory only (does not search upward)
   */
  findConfigFileInCurrentDir(): string | null {
    const currentDir = process.cwd();
    for (const fileName of LINK_FILE_NAMES) {
      const filePath = path.join(currentDir, fileName);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    return null;
  }

  /**
   * Create a new configuration file with default content
   */
  createConfig(links: FileLinkConfigArray = []): string {
    const configPath = this.getDefaultConfigPath();

    if (fs.existsSync(configPath)) {
      throw new Error(
        `Configuration file already exists at ${configPath}. Use --force to overwrite.`
      );
    }

    this.saveConfig(links, configPath);
    return configPath;
  }

  /**
   * Validate a configuration array
   */
  validateConfig(config: FileLinkConfigArray): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(config)) {
      errors.push('Configuration must be an array');
      return { valid: false, errors };
    }

    config.forEach((link, index) => {
      if (!link.watch || !Array.isArray(link.watch) || link.watch.length === 0) {
        errors.push(`Link at index ${index}: 'watch' must be a non-empty array`);
      }

      if (!link.target || !Array.isArray(link.target) || link.target.length === 0) {
        errors.push(`Link at index ${index}: 'target' must be a non-empty array`);
      }

      if (link.watchType && !['uncommitted', 'unstaged', 'staged'].includes(link.watchType)) {
        errors.push(
          `Link at index ${index}: 'watchType' must be 'uncommitted', 'unstaged', or 'staged'`
        );
      }

      if (link.id && typeof link.id !== 'string') {
        errors.push(`Link at index ${index}: 'id' must be a string`);
      }

      if (link.name && typeof link.name !== 'string') {
        errors.push(`Link at index ${index}: 'name' must be a string`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get the current config path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }
}

export const configManager = new ConfigManager();
