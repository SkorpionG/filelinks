#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { newCommand } from './commands/new';
import { validateCommand } from './commands/validate';
import { checkCommand } from './commands/check';
import { listCommand } from './commands/list';
import { orphansCommand } from './commands/orphans';
import { CLI_NAME } from './constants';

const program = new Command();

program
  .name(CLI_NAME)
  .description('CLI tool for declaring implicit links between files in a workspace')
  .version('0.1.0');

// Init command - create root configuration (TypeScript only)
program
  .command('init')
  .description('Initialize root configuration at git repository root (creates TypeScript file)')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// New command - create link file (JSON)
program
  .command('new')
  .description('Create a new link file (JSON) - can be used in any directory')
  .option('-f, --force', 'Overwrite existing link file')
  .option('-e, --empty', 'Create an empty link file')
  .option('-s, --skip-root', 'Skip adding to root configuration')
  .action(async (options) => {
    try {
      await newCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all configured file links')
  .option('--local', 'List only link files in current directory (non-recursive)')
  .option('--config', 'List link files from root configuration')
  .option('-v, --verbose', 'Show file sizes and link counts')
  .action(async (options) => {
    try {
      await listCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Orphans command
program
  .command('orphans')
  .description('Find orphaned link files not referenced by config or extends')
  .option('-v, --verbose', 'Show verbose output with reference details')
  .action(async (options) => {
    try {
      await orphansCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Check command
program
  .command('check [file]')
  .description('Check for changes in watched files and notify about targets')
  .option('--id <id>', 'Check only specific link file by ID')
  .option('-v, --verbose', 'Show verbose output with commit information')
  .action(async (file, options) => {
    try {
      await checkCommand({ ...options, file });
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add command (placeholder)
program
  .command('add')
  .description('Add a new file link')
  .action(() => {
    console.log(chalk.yellow('Coming soon: add command'));
  });

// Remove command (placeholder)
program
  .command('remove')
  .description('Remove a file link')
  .action(() => {
    console.log(chalk.yellow('Coming soon: remove command'));
  });

// Validate command
program
  .command('validate [file]')
  .description('Validate the configuration file')
  .option('--root', 'Validate only the root configuration (skip link files)')
  .action(async (file, options) => {
    try {
      await validateCommand(file, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);
