import inquirer from 'inquirer';
import chalk from 'chalk';
import type { UserConfig } from '../types/index.js';
import { NETWORK_PRESETS } from './config-manager.js';

/**
 * Whale Alert wizard prompts
 */
export async function whaleAlertWizard(): Promise<UserConfig> {
  console.log(chalk.cyan.bold('\nWhale Alert Setup\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'network',
      message: 'Which network?',
      choices: [
        { name: 'Stellar Mainnet', value: 'stellar_mainnet' },
        { name: 'Stellar Testnet', value: 'stellar_testnet' },
        { name: 'Ethereum Mainnet', value: 'ethereum_mainnet' },
      ],
      default: 'stellar_mainnet',
    },
    {
      type: 'input',
      name: 'contractAddress',
      message: 'Contract address to watch:',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Contract address is required';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'contractName',
      message: 'Contract name (optional, for display):',
      default: '',
    },
    {
      type: 'input',
      name: 'threshold',
      message: 'Alert threshold (minimum transfer amount):',
      default: '1000000',
      validate: (input: string) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a valid positive number';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'notificationType',
      message: 'Where to send alerts?',
      choices: [
        { name: 'Discord', value: 'discord' },
        { name: 'Telegram', value: 'telegram' },
        { name: 'Slack', value: 'slack' },
      ],
      default: 'discord',
    },
  ]);

  // Get webhook/bot details based on notification type
  let webhookUrl = '';

  if (answers.notificationType === 'discord') {
    const { discordWebhook } = await inquirer.prompt([
      {
        type: 'input',
        name: 'discordWebhook',
        message: 'Discord webhook URL:',
        validate: (input: string) => {
          if (!input.startsWith('https://discord.com/api/webhooks/')) {
            return 'Please enter a valid Discord webhook URL';
          }
          return true;
        },
      },
    ]);
    webhookUrl = discordWebhook;
  } else if (answers.notificationType === 'telegram') {
    const telegramAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'Telegram bot token:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Bot token is required';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'chatId',
        message: 'Telegram chat ID:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Chat ID is required';
          }
          return true;
        },
      },
    ]);
    // Store as JSON for telegram
    webhookUrl = JSON.stringify({
      token: telegramAnswers.token,
      chatId: telegramAnswers.chatId,
    });
  } else if (answers.notificationType === 'slack') {
    const { slackWebhook } = await inquirer.prompt([
      {
        type: 'input',
        name: 'slackWebhook',
        message: 'Slack webhook URL:',
        validate: (input: string) => {
          if (!input.startsWith('https://hooks.slack.com/')) {
            return 'Please enter a valid Slack webhook URL';
          }
          return true;
        },
      },
    ]);
    webhookUrl = slackWebhook;
  }

  return {
    network: answers.network,
    contractAddress: answers.contractAddress,
    contractName: answers.contractName || undefined,
    threshold: answers.threshold,
    notificationType: answers.notificationType,
    webhookUrl,
  };
}

/**
 * Confirm using saved config
 */
export async function confirmUseSavedConfig(tool: string): Promise<boolean> {
  const { useSaved } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useSaved',
      message: `Found saved ${tool} configuration. Use it?`,
      default: true,
    },
  ]);
  return useSaved;
}

/**
 * Display configuration summary
 */
export function displayConfigSummary(config: UserConfig): void {
  const network = NETWORK_PRESETS[config.network];

  console.log(chalk.cyan('\nConfiguration Summary:'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  Network:      ${chalk.white(network?.name || config.network)}`);
  console.log(`  Contract:     ${chalk.white(config.contractName || config.contractAddress)}`);
  console.log(`  Threshold:    ${chalk.white(config.threshold)} tokens`);
  console.log(`  Alerts via:   ${chalk.white(config.notificationType)}`);
  console.log(chalk.dim('─'.repeat(40)));
}

/**
 * Confirm start monitor
 */
export async function confirmStart(): Promise<boolean> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Start the monitor now?',
      default: true,
    },
  ]);
  return confirm;
}
