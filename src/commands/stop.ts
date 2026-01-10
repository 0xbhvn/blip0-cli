import chalk from 'chalk';
import ora from 'ora';
import { loadSessions } from '../lib/config-manager.js';
import { stopMonitor } from '../lib/runtime-manager.js';

export async function stopCommand(sessionId: string): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Please provide a session ID'));
    console.log(chalk.dim('\nView running monitors with:'));
    console.log(`  ${chalk.white('blip0 list')}`);
    return;
  }

  const sessions = await loadSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    console.error(chalk.red(`Session not found: ${sessionId}`));
    console.log(chalk.dim('\nView running monitors with:'));
    console.log(`  ${chalk.white('blip0 list')}`);
    return;
  }

  const spinner = ora(`Stopping ${session.tool} (${sessionId})...`).start();

  const success = await stopMonitor(sessionId);

  if (success) {
    spinner.succeed(`Stopped ${session.tool}`);
  } else {
    spinner.fail(`Failed to stop ${session.tool}`);
  }
}
