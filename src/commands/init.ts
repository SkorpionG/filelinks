import * as fs from 'fs';
import * as path from 'path';
import { requireGitRepository } from '../utils/commandHelpers';
import { glob } from 'glob';
import { ROOT_CONFIG_FILE_NAME, LINK_FILE_NAMES, IGNORE_PATTERNS, CLI_NAME } from '../constants';
import { ERROR_MESSAGES } from '../constants/messages';
import { LinkFileReference } from '../types';
import { createLinkFileReference } from '../utils/rootConfig';
import {
  displayCommandHeader,
  displayWarning,
  displayDim,
  displayProcessing,
  displaySuccess,
  displayHeader,
  displayInstructionList,
  displayList,
  displayBlankLine,
} from '../utils/ui';

/**
 * Options for the 'init' command
 */
export interface InitOptions {
  /** Overwrite existing configuration file if it exists */
  force?: boolean;
}

/**
 * Initialize a root-level filelinks configuration (TypeScript only)
 *
 * This command MUST be run at the root of a git repository. It creates a
 * TypeScript configuration file that references all link files (.links.json)
 * in the repository.
 *
 * Behavior:
 * - Only works at git repository root (exits with error if not at root)
 * - Scans for existing .links.json files in the repository
 * - Creates filelinks.config.ts with references to all found link files
 * - With --force flag: Overwrites existing root configuration
 *
 * @param options - Command options (force)
 * @returns Promise that resolves when root configuration is created
 *
 * @example
 * // Create root config at repo root
 * await initCommand({});
 *
 * @example
 * // Force overwrite existing config
 * await initCommand({ force: true });
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  displayCommandHeader(`Initialize ${CLI_NAME} root configuration`, '');

  const currentDir = process.cwd();

  // Check if we're at the git repository root (required for init)
  requireGitRepository(true, CLI_NAME);

  // Determine config file path
  const configPath = path.join(currentDir, ROOT_CONFIG_FILE_NAME);

  // Check if config already exists
  if (fs.existsSync(configPath) && !options.force) {
    displayWarning(`${ERROR_MESSAGES.CONFIG_FILE_EXISTS}: ${configPath}`);
    displayWarning('Use --force to overwrite.\n');
    return;
  }

  // Find all link files in the repository
  displayProcessing('Scanning for link files');

  const linkFiles = await findLinkFiles(currentDir);

  if (linkFiles.length === 0) {
    displayWarning('No link files found.');
    displayDim(`Create one using: ${CLI_NAME} new\n`);
  } else {
    displaySuccess(`Found ${linkFiles.length} link file(s):`);
    const items = linkFiles.map((linkFile) => {
      const relativePath = path.relative(currentDir, linkFile.path);
      return `${linkFile.id} - ${relativePath}`;
    });
    displayList(items);
    displayBlankLine();
  }

  // Generate the configuration file content
  const configContent = generateTypeScriptConfig(linkFiles);

  // Write the configuration file
  fs.writeFileSync(configPath, configContent, 'utf-8');

  displaySuccess(`Created root configuration: ${ROOT_CONFIG_FILE_NAME}\n`);

  // Show next steps
  displayInstructionList('Next steps:', [
    `Run "${CLI_NAME} validate" to validate all configurations`,
    `Run "${CLI_NAME} check" to check for changes`,
    `Run "${CLI_NAME} new" to create additional link files`,
  ]);

  // Show example of how to use the config
  displayHeader('Usage in code:');
  displayDim(`  import config from './${ROOT_CONFIG_FILE_NAME}';`);
  displayDim(`  // config.linkFiles contains all link file references\n`);
}

/**
 * Find all filelinks link files in the repository
 *
 * Searches for files matching the following patterns:
 * - filelinks.links.json
 * - .filelinksrc.json
 * - .filelinksrc
 *
 * Generates IDs based on the directory structure
 *
 * @param rootDir - The root directory to search from
 * @returns Promise that resolves to an array of link file references
 */
async function findLinkFiles(rootDir: string): Promise<LinkFileReference[]> {
  const patterns = LINK_FILE_NAMES.map((name) => `**/${name}`);
  const linkFiles: LinkFileReference[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: rootDir,
      absolute: true,
      ignore: IGNORE_PATTERNS as unknown as string[],
    });

    for (const filePath of matches) {
      const linkFile = createLinkFileReference(filePath, rootDir);
      linkFiles.push(linkFile);
    }
  }

  // Remove duplicates by ID and sort
  const uniqueMap = new Map<string, LinkFileReference>();
  for (const linkFile of linkFiles) {
    if (!uniqueMap.has(linkFile.id)) {
      uniqueMap.set(linkFile.id, linkFile);
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Generate TypeScript configuration file content
 *
 * Creates a TypeScript file that exports a RootConfig object with
 * references to all link files.
 *
 * @param linkFiles - Array of link file references
 * @returns The generated TypeScript file content
 */
function generateTypeScriptConfig(linkFiles: LinkFileReference[]): string {
  const lines: string[] = [];

  // File header comment
  lines.push('/**');
  lines.push(` * ${CLI_NAME} root configuration`);
  lines.push(' * This file references all link files in the repository');
  lines.push(` * Generated by: ${CLI_NAME} init`);
  lines.push(' */');
  lines.push('');

  // Import types
  lines.push(`import { RootConfig } from '${CLI_NAME}';`);
  lines.push('');

  // Create config object
  lines.push('const config: RootConfig = {');
  lines.push('  linkFiles: [');

  if (linkFiles.length === 0) {
    lines.push('    // No link files found');
    lines.push('    // Create one using: ' + CLI_NAME + ' new');
  } else {
    linkFiles.forEach((linkFile, index) => {
      lines.push('    {');
      lines.push(`      id: '${linkFile.id}',`);
      lines.push(`      name: '${linkFile.name}',`);
      lines.push(`      path: '${linkFile.path}',`);
      lines.push(`    }${index < linkFiles.length - 1 ? ',' : ''}`);
    });
  }

  lines.push('  ],');
  lines.push('};');
  lines.push('');
  lines.push('export default config;');
  lines.push('');

  return lines.join('\n');
}
