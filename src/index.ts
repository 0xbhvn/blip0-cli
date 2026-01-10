#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { whaleAlertCommand } from './commands/whale-alert.js';
import { listCommand } from './commands/list.js';
import { stopCommand } from './commands/stop.js';
import pkg from '../package.json';

const program = new Command();

program
  .name('blip0')
  .description('Zero-config blockchain monitoring CLI built on OpenZeppelin Monitor')
  .version(pkg.version);

// Whale Alert command
program
  .command('whale-alert')
  .description('Monitor large transfers on a contract')
  .option('-r, --reconfigure', 'Reconfigure settings')
  .option('-n, --network <network>', 'Network to monitor (stellar_mainnet, ethereum_mainnet)')
  .option('-t, --threshold <amount>', 'Minimum transfer amount to alert')
  .option('-c, --contract <address>', 'Contract address to monitor')
  .action(async (options) => {
    try {
      await whaleAlertCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List running monitors')
  .action(async () => {
    try {
      await listCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop <session-id>')
  .description('Stop a running monitor')
  .action(async (sessionId) => {
    try {
      await stopCommand(sessionId);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
