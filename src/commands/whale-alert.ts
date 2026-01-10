import chalk from 'chalk';
import ora from 'ora';
import {
  hasConfig,
  loadUserConfig,
  saveUserConfig,
  createSessionDir,
  writeOZConfigs,
  NETWORK_PRESETS,
} from '../lib/config-manager.js';
import {
  loadTemplate,
  buildTemplateVars,
} from '../lib/template-engine.js';
import { startMonitor, generateSessionId } from '../lib/runtime-manager.js';
import {
  whaleAlertWizard,
  confirmUseSavedConfig,
  displayConfigSummary,
  confirmStart,
} from '../lib/wizard.js';

const TOOL_NAME = 'whale-alert';

interface WhaleAlertOptions {
  reconfigure?: boolean;
  network?: string;
  threshold?: string;
  contract?: string;
}

export async function whaleAlertCommand(options: WhaleAlertOptions): Promise<void> {
  console.log(chalk.cyan.bold('\nWhale Alert - Large Transfer Monitor\n'));

  let config = await loadUserConfig(TOOL_NAME);

  // Check if we should reconfigure or use saved config
  if (config && !options.reconfigure) {
    const useSaved = await confirmUseSavedConfig(TOOL_NAME);
    if (!useSaved) {
      config = null;
    }
  }

  // If no config or reconfiguring, run wizard
  if (!config || options.reconfigure) {
    config = await whaleAlertWizard();
    await saveUserConfig(TOOL_NAME, config);
    console.log(chalk.green('\nConfiguration saved!'));
  }

  // Apply CLI overrides
  if (options.network) config.network = options.network;
  if (options.threshold) config.threshold = options.threshold;
  if (options.contract) config.contractAddress = options.contract;

  // Display summary
  displayConfigSummary(config);

  // Confirm start
  const shouldStart = await confirmStart();
  if (!shouldStart) {
    console.log(chalk.yellow('\nMonitor not started. Run again when ready.'));
    return;
  }

  // Generate OZ Monitor configs
  const spinner = ora('Generating configuration...').start();

  try {
    const networkPreset = NETWORK_PRESETS[config.network];
    if (!networkPreset) {
      spinner.fail(`Unknown network: ${config.network}`);
      return;
    }

    // Build template variables
    const vars = buildTemplateVars(TOOL_NAME, config, networkPreset);

    // Load and process templates
    const networkConfig = await loadTemplate('networks', networkPreset.slug);
    const monitorConfig = await loadTemplate('monitors', 'whale_alert', vars);
    const triggerConfig = await loadTemplate('triggers', config.notificationType, vars);

    // Create session directory and write configs
    const sessionId = generateSessionId();
    const sessionDir = await createSessionDir(sessionId);
    await writeOZConfigs(sessionDir, networkConfig, monitorConfig, triggerConfig);

    spinner.succeed('Configuration generated');

    // Start the monitor
    console.log(chalk.cyan('\nStarting OpenZeppelin Monitor...'));
    const session = await startMonitor(sessionDir, TOOL_NAME, sessionId);

    if (session) {
      console.log(chalk.green.bold('\nWhale Alert is running!'));
      console.log(chalk.dim(`Session ID: ${session.id}`));
      console.log(chalk.dim(`Watching for transfers > ${config.threshold} tokens`));
      console.log(chalk.dim(`on ${networkPreset.name}\n`));
      console.log(chalk.cyan('Commands:'));
      console.log(`  ${chalk.white('blip0 list')}    - View running monitors`);
      console.log(`  ${chalk.white(`blip0 stop ${session.id}`)} - Stop this monitor\n`);
    } else {
      console.error(chalk.red('\nFailed to start monitor'));
    }
  } catch (error) {
    spinner.fail('Failed to generate configuration');
    console.error(chalk.red('Error:'), error);
  }
}
