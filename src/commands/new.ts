import inquirer from 'inquirer';
import { configManager } from '../config';
import { FileLinkConfig, WatchType } from '../types';
import { isInGitRepo, findGitRoot } from '../utils/git';
import { CLI_NAME, DEFAULT_LINK_FILE_NAME } from '../constants';
import {
  findRootConfigFile,
  addLinkFileToRootConfig,
  createLinkFileReference,
} from '../utils/rootConfig';
import {
  displayCommandHeader,
  displayWarning,
  displaySuccess,
  displayDim,
  displayHeader,
  displayInstructionList,
} from '../utils/ui';

/**
 * Options for the 'new' command
 */
export interface NewOptions {
  /** Overwrite existing link file if it exists */
  force?: boolean;
  /** Create an empty link file without prompts */
  empty?: boolean;
}

/**
 * Create a new filelinks link file (JSON format)
 *
 * This command can be run in any directory (including subdirectories within a git repo)
 * to create a local filelinks.links.json file. This allows for multiple link
 * files in different parts of a project.
 *
 * Behavior:
 * - In interactive mode (default): Prompts user to add file links one by one
 * - With --empty flag: Creates an empty link file []
 * - With --force flag: Overwrites existing link file if present
 * - Warns if not in a git repository (filelinks works best with git)
 * - Only checks current directory for existing files (not parent directories)
 *
 * @param options - Command options (force, empty)
 * @returns Promise that resolves when link file is created
 *
 * @example
 * // Interactive mode
 * await newCommand({});
 *
 * @example
 * // Create empty link file
 * await newCommand({ empty: true });
 *
 * @example
 * // Force overwrite
 * await newCommand({ force: true });
 */
export async function newCommand(options: NewOptions = {}): Promise<void> {
  displayCommandHeader(`Create new ${CLI_NAME} link file`, '');

  // Check if link file already exists in the current directory only (not parent directories)
  const existingConfig = configManager.findConfigFileInCurrentDir();
  if (existingConfig && !options.force) {
    displayWarning(`Link file already exists at: ${existingConfig}`);
    displayWarning('Use --force to overwrite.');
    return;
  }

  if (existingConfig && options.force) {
    displayWarning(`Overwriting existing link file at: ${existingConfig}`);
  }

  // Check if we're in a git repository (warn if not)
  if (!isInGitRepo()) {
    displayWarning(`Not in a git repository. ${CLI_NAME} works best with git.`);
  }

  const links: FileLinkConfig[] = [];

  // Handle --empty flag: create empty link file and exit
  if (options.empty) {
    const configPath = configManager.getDefaultConfigPath();
    configManager.saveConfig(links, configPath);
    displaySuccess(`Created empty link file: ${configPath}`);
    displayDim(`  File: ${DEFAULT_LINK_FILE_NAME}`);

    // Try to add to root config if in a git repository
    await tryAddToRootConfig(configPath);

    displayDim(`Add links using: ${CLI_NAME} add <watch> <target>`);
    return;
  }

  // Interactive mode: ask if user wants to add a link now
  const { addLink } = await inquirer.prompt<{ addLink: boolean }>([
    {
      type: 'confirm',
      name: 'addLink',
      message: 'Would you like to add a file link now?',
      default: true,
    },
  ]);

  // If user wants to add links, enter the link creation loop
  if (addLink) {
    let addMore = true;

    while (addMore) {
      const link = await promptForLink();
      links.push(link);

      // Ask if user wants to add another link
      const { continueAdding } = await inquirer.prompt<{ continueAdding: boolean }>([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another link?',
          default: false,
        },
      ]);

      addMore = continueAdding;
    }
  }

  // Determine the path to save the configuration
  const configPath = options.force
    ? existingConfig || configManager.getDefaultConfigPath()
    : configManager.getDefaultConfigPath();

  // Save the configuration to disk
  configManager.saveConfig(links, configPath);

  // Display success message
  displaySuccess(`Link file created: ${configPath}`);
  displayDim(`  Added ${links.length} link(s)`);

  // Try to add to root config if in a git repository
  await tryAddToRootConfig(configPath);

  // Show next steps to the user
  displayInstructionList('Next steps:', [
    `Run "${CLI_NAME} list" to see configured links`,
    `Run "${CLI_NAME} check" to check for changes`,
    `Run "${CLI_NAME} add <watch> <target>" to add more links`,
  ]);
}

/**
 * Try to add the newly created link file to the root config
 *
 * This function finds the git root, checks if a root config exists,
 * and adds the new link file reference to it if possible.
 *
 * @param linkFilePath - Absolute path to the newly created link file
 */
async function tryAddToRootConfig(linkFilePath: string): Promise<void> {
  // Find git root
  const gitRoot = findGitRoot();
  if (!gitRoot) {
    displayWarning('Not in a git repository. Skipping root config update.');
    displayDim(`  Run "${CLI_NAME} init" at the git root to create a root config.`);
    return;
  }

  // Check if root config exists
  const rootConfigPath = findRootConfigFile(gitRoot);
  if (!rootConfigPath) {
    displayWarning('No root configuration found.');
    displayDim(`  Run "${CLI_NAME} init" at the git root to create one.`);
    return;
  }

  // Create link file reference
  const linkFileRef = createLinkFileReference(linkFilePath, gitRoot);

  // Try to add to root config
  try {
    const added = addLinkFileToRootConfig(rootConfigPath, linkFileRef);
    if (added) {
      displaySuccess('Added to root configuration');
      displayDim(`  ID: ${linkFileRef.id}`);
      displayDim(`  Config: ${rootConfigPath}`);
    } else {
      displayWarning('Link file already exists in root configuration.');
    }
  } catch (error) {
    displayWarning('Warning: Failed to update root configuration');
    displayDim(`  ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Prompt the user to create a new file link interactively
 *
 * This function displays a series of prompts to collect all necessary
 * information for a file link configuration:
 * - Name (optional): Human-readable name
 * - Description (optional): What the link ensures
 * - Watch patterns (required): Comma-separated file patterns to watch
 * - Target patterns (required): Comma-separated files that should be updated
 * - Watch type: Type of git changes to detect (uncommitted/unstaged/staged)
 * - ID (optional): Custom identifier
 *
 * @returns Promise that resolves to a FileLinkConfig object
 *
 * @example
 * const link = await promptForLink();
 * // Returns: { watch: ['src/*.ts'], target: ['docs/README.md'], watchType: 'uncommitted' }
 */
async function promptForLink(): Promise<FileLinkConfig> {
  displayHeader('Add a new file link:');

  // Collect all link information via prompts
  const answers = await inquirer.prompt<{
    name: string;
    description: string;
    watch: string;
    target: string;
    watchType: WatchType;
    addId: boolean;
    id?: string;
  }>([
    {
      type: 'input',
      name: 'name',
      message: 'Link name (optional):',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
    },
    {
      type: 'input',
      name: 'watch',
      message: 'Watch files (comma-separated patterns):',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'At least one watch pattern is required';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'target',
      message: 'Target files (comma-separated patterns):',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'At least one target pattern is required';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'watchType',
      message: 'Watch type:',
      choices: [
        { name: 'Uncommitted (any changes not yet committed)', value: 'uncommitted' },
        { name: 'Unstaged (changes not yet staged)', value: 'unstaged' },
        { name: 'Staged (changes that are staged)', value: 'staged' },
      ],
      default: 'uncommitted',
    },
    {
      type: 'confirm',
      name: 'addId',
      message: 'Add a custom ID?',
      default: false,
    },
    {
      type: 'input',
      name: 'id',
      message: 'Custom ID:',
      when: (answers) => answers.addId,
    },
  ]);

  // Build the link configuration object with required fields
  const link: FileLinkConfig = {
    watch: answers.watch.split(',').map((s) => s.trim()),
    target: answers.target.split(',').map((s) => s.trim()),
    watchType: answers.watchType,
  };

  // Add optional fields if provided
  if (answers.name) {
    link.name = answers.name;
  }

  if (answers.description) {
    link.description = answers.description;
  }

  if (answers.id) {
    link.id = answers.id;
  }

  return link;
}
