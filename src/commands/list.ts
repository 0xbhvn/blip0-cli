import chalk from 'chalk';
import { loadSessions } from '../lib/config-manager.js';
import { isSessionRunning } from '../lib/runtime-manager.js';

export async function listCommand(): Promise<void> {
  console.log(chalk.cyan.bold('\nRunning Monitors\n'));

  const sessions = await loadSessions();

  if (sessions.length === 0) {
    console.log(chalk.dim('No monitors running.'));
    console.log(chalk.dim('\nStart one with:'));
    console.log(`  ${chalk.white('blip0 whale-alert')}`);
    console.log();
    return;
  }

  // Check actual status of each session
  console.log(chalk.dim('─'.repeat(70)));
  console.log(
    `${chalk.white('ID'.padEnd(12))} ${chalk.white('Tool'.padEnd(16))} ${chalk.white('Status'.padEnd(12))} ${chalk.white('Started')}`
  );
  console.log(chalk.dim('─'.repeat(70)));

  for (const session of sessions) {
    const isRunning = await isSessionRunning(session.id);
    const status = isRunning
      ? chalk.green('running')
      : chalk.red('stopped');

    const startedAt = new Date(session.startedAt).toLocaleString();

    console.log(
      `${chalk.cyan(session.id.padEnd(12))} ${session.tool.padEnd(16)} ${status.padEnd(20)} ${chalk.dim(startedAt)}`
    );
  }

  console.log(chalk.dim('─'.repeat(70)));
  console.log();
  console.log(chalk.dim('Stop a monitor with:'));
  console.log(`  ${chalk.white('blip0 stop <session-id>')}`);
  console.log();
}
