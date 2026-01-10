import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';
import type { SessionInfo } from '../types/index.js';
import {
  addSession,
  updateSessionStatus,
  removeSession,
  cleanupSession,
  loadSessions,
} from './config-manager.js';

const BLIP0_DIR = join(homedir(), '.blip0');
const BIN_DIR = join(BLIP0_DIR, 'bin');

/**
 * Check if OZ Monitor binary exists
 */
export async function hasBinary(): Promise<boolean> {
  const binaryPath = join(BIN_DIR, 'openzeppelin-monitor');
  return await Bun.file(binaryPath).exists();
}

/**
 * Get the appropriate asset name for the current platform
 */
function getAssetName(version: string): string {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    return arch === 'arm64'
      ? `openzeppelin-monitor-${version}-aarch64-apple-darwin.tar.gz`
      : `openzeppelin-monitor-${version}-x86_64-apple-darwin.tar.gz`;
  } else if (platform === 'linux') {
    return arch === 'arm64'
      ? `openzeppelin-monitor-${version}-aarch64-unknown-linux-gnu.tar.gz`
      : `openzeppelin-monitor-${version}-x86_64-unknown-linux-gnu.tar.gz`;
  }

  throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

/**
 * Download OZ Monitor binary from GitHub releases
 */
export async function downloadBinary(): Promise<boolean> {
  const spinner = ora('Downloading OpenZeppelin Monitor...').start();

  try {
    await Bun.$`mkdir -p ${BIN_DIR}`.quiet();

    // Get latest release info
    spinner.text = 'Fetching latest release info...';
    const releaseUrl = 'https://api.github.com/repos/OpenZeppelin/openzeppelin-monitor/releases/latest';
    const response = await fetch(releaseUrl, {
      headers: { 'User-Agent': 'blip0-cli' },
    });

    if (!response.ok) {
      spinner.fail('Failed to fetch release info');
      return false;
    }

    const release = await response.json() as {
      tag_name: string;
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const version = release.tag_name; // e.g., "v1.1.0"

    // Find the right asset
    const assetName = getAssetName(version);
    const asset = release.assets?.find((a) => a.name === assetName);

    if (!asset) {
      spinner.fail(`Binary not found for your platform (${process.platform}/${process.arch})`);
      console.log(chalk.dim('Available assets:'));
      release.assets?.forEach((a) => console.log(chalk.dim(`  - ${a.name}`)));
      return false;
    }

    // Download the tarball
    spinner.text = `Downloading ${assetName}...`;
    const downloadUrl = asset.browser_download_url;
    const tarballPath = join(BIN_DIR, assetName);

    await Bun.$`curl -L -o ${tarballPath} ${downloadUrl}`.quiet();

    // Extract the binary
    spinner.text = 'Extracting binary...';
    await Bun.$`tar -xzf ${tarballPath} -C ${BIN_DIR}`.quiet();

    // Clean up tarball
    await Bun.$`rm ${tarballPath}`.quiet();

    // Make binary executable
    const binaryPath = join(BIN_DIR, 'openzeppelin-monitor');
    await Bun.$`chmod +x ${binaryPath}`.quiet();

    // Verify binary exists
    if (!(await Bun.file(binaryPath).exists())) {
      spinner.fail('Binary extraction failed');
      return false;
    }

    spinner.succeed(`OpenZeppelin Monitor ${version} installed`);
    return true;
  } catch (error) {
    spinner.fail('Failed to download binary');
    console.error(chalk.red('Error:'), error);
    return false;
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Start OZ Monitor with binary
 */
export async function startWithBinary(
  sessionId: string,
  sessionDir: string,
  tool: string
): Promise<SessionInfo | null> {
  const binaryPath = join(BIN_DIR, 'openzeppelin-monitor');

  try {
    // Start the process in the background
    const proc = Bun.spawn([binaryPath], {
      cwd: sessionDir,
      env: {
        ...process.env,
        RUST_LOG: 'info',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const session: SessionInfo = {
      id: sessionId,
      tool,
      configPath: sessionDir,
      pid: proc.pid,
      startedAt: new Date(),
      status: 'running',
    };

    await addSession(session);

    // Monitor the process for early failure
    setTimeout(async () => {
      try {
        const isRunning = await isSessionRunning(sessionId);
        if (!isRunning) {
          await updateSessionStatus(sessionId, 'error');
        }
      } catch {
        // Ignore errors in background check
      }
    }, 2000);

    return session;
  } catch (error) {
    console.error(chalk.red('Failed to start binary:'), error);
    return null;
  }
}

/**
 * Start OZ Monitor
 */
export async function startMonitor(
  sessionDir: string,
  tool: string,
  sessionId?: string
): Promise<SessionInfo | null> {
  const id = sessionId || generateSessionId();

  // Ensure binary is available
  if (!(await hasBinary())) {
    const downloaded = await downloadBinary();
    if (!downloaded) {
      console.error(chalk.red('Failed to set up OZ Monitor'));
      return null;
    }
  }

  return startWithBinary(id, sessionDir, tool);
}

/**
 * Stop a running monitor
 */
export async function stopMonitor(sessionId: string): Promise<boolean> {
  const sessions = await loadSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    console.error(chalk.red('Session not found'));
    return false;
  }

  try {
    if (session.pid) {
      // Kill the process
      try {
        await Bun.$`kill ${session.pid}`.quiet();
      } catch {
        // Process might already be dead
      }
    }

    await updateSessionStatus(sessionId, 'stopped');
    await cleanupSession(sessionId);
    await removeSession(sessionId);

    return true;
  } catch (error) {
    console.error(chalk.red('Failed to stop monitor:'), error);
    return false;
  }
}

/**
 * Check if a session is still running
 */
export async function isSessionRunning(sessionId: string): Promise<boolean> {
  const sessions = await loadSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) return false;

  try {
    if (session.pid) {
      const result = await Bun.$`ps -p ${session.pid}`.quiet();
      return result.exitCode === 0;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get the binary path
 */
export function getBinaryPath(): string {
  return join(BIN_DIR, 'openzeppelin-monitor');
}
