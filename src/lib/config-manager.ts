import { homedir } from "node:os";
import { join } from "node:path";
import type { NetworkPreset, SessionInfo, UserConfig } from "../types/index.js";

const BLIP0_DIR = join(homedir(), ".blip0");
const CONFIGS_DIR = join(BLIP0_DIR, "configs");
const RUNTIME_DIR = join(BLIP0_DIR, "runtime");
const SESSIONS_FILE = join(BLIP0_DIR, "sessions.json");

// Network presets
export const NETWORK_PRESETS: Record<string, NetworkPreset> = {
	stellar_mainnet: {
		slug: "stellar_mainnet",
		name: "Stellar Mainnet",
		type: "Stellar",
		rpcUrl: "https://stellar-soroban-public.nodies.app",
		networkPassphrase: "Public Global Stellar Network ; September 2015",
		blockTimeMs: 5000,
		explorerUrl: "https://stellar.expert/explorer/public",
	},
	stellar_testnet: {
		slug: "stellar_testnet",
		name: "Stellar Testnet",
		type: "Stellar",
		rpcUrl: "https://stellar-soroban-testnet-public.nodies.app",
		networkPassphrase: "Test SDF Network ; September 2015",
		blockTimeMs: 5000,
		explorerUrl: "https://stellar.expert/explorer/testnet",
	},
	ethereum_mainnet: {
		slug: "ethereum_mainnet",
		name: "Ethereum Mainnet",
		type: "EVM",
		rpcUrl: "https://eth.llamarpc.com",
		chainId: 1,
		blockTimeMs: 12000,
		explorerUrl: "https://etherscan.io",
	},
};

/**
 * Ensure blip0 directories exist
 */
export async function ensureDirectories(): Promise<void> {
	await Bun.$`mkdir -p ${CONFIGS_DIR} ${RUNTIME_DIR}`.quiet();
}

/**
 * Save user config for a tool
 */
export async function saveUserConfig(tool: string, config: UserConfig): Promise<void> {
	await ensureDirectories();
	const configPath = join(CONFIGS_DIR, `${tool}.json`);
	await Bun.write(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load user config for a tool
 */
export async function loadUserConfig(tool: string): Promise<UserConfig | null> {
	const configPath = join(CONFIGS_DIR, `${tool}.json`);
	const file = Bun.file(configPath);
	if (!(await file.exists())) {
		return null;
	}
	const content = await file.text();
	return JSON.parse(content);
}

/**
 * Check if config exists for a tool
 */
export async function hasConfig(tool: string): Promise<boolean> {
	const configPath = join(CONFIGS_DIR, `${tool}.json`);
	return await Bun.file(configPath).exists();
}

/**
 * Delete user config for a tool
 */
export async function deleteUserConfig(tool: string): Promise<void> {
	const configPath = join(CONFIGS_DIR, `${tool}.json`);
	await Bun.$`rm -f ${configPath}`.quiet();
}

/**
 * Create a runtime session directory
 */
export async function createSessionDir(sessionId: string): Promise<string> {
	const sessionDir = join(RUNTIME_DIR, `session-${sessionId}`);
	await Bun.$`mkdir -p ${sessionDir}/config/networks ${sessionDir}/config/monitors ${sessionDir}/config/triggers ${sessionDir}/data`.quiet();
	return sessionDir;
}

/**
 * Write OZ Monitor config files to session directory
 */
export async function writeOZConfigs(
	sessionDir: string,
	network: Record<string, unknown>,
	monitor: Record<string, unknown>,
	trigger: Record<string, unknown>,
): Promise<void> {
	const networkSlug = network.slug as string;
	const monitorName = (monitor.name as string).toLowerCase().replace(/\s+/g, "_");
	const triggerId = Object.keys(trigger)[0];

	await Bun.write(
		join(sessionDir, "config", "networks", `${networkSlug}.json`),
		JSON.stringify(network, null, 2),
	);
	await Bun.write(
		join(sessionDir, "config", "monitors", `${monitorName}.json`),
		JSON.stringify(monitor, null, 2),
	);
	await Bun.write(
		join(sessionDir, "config", "triggers", `${triggerId}.json`),
		JSON.stringify(trigger, null, 2),
	);
}

/**
 * Load all sessions
 */
export async function loadSessions(): Promise<SessionInfo[]> {
	const file = Bun.file(SESSIONS_FILE);
	if (!(await file.exists())) {
		return [];
	}
	const content = await file.text();
	return JSON.parse(content);
}

/**
 * Save sessions
 */
export async function saveSessions(sessions: SessionInfo[]): Promise<void> {
	await ensureDirectories();
	await Bun.write(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

/**
 * Add a session
 */
export async function addSession(session: SessionInfo): Promise<void> {
	const sessions = await loadSessions();
	sessions.push(session);
	await saveSessions(sessions);
}

/**
 * Update session status
 */
export async function updateSessionStatus(
	sessionId: string,
	status: SessionInfo["status"],
	extra?: { pid?: number; containerId?: string },
): Promise<void> {
	const sessions = await loadSessions();
	const session = sessions.find((s) => s.id === sessionId);
	if (session) {
		session.status = status;
		if (extra?.pid) session.pid = extra.pid;
		if (extra?.containerId) session.containerId = extra.containerId;
		await saveSessions(sessions);
	}
}

/**
 * Remove a session
 */
export async function removeSession(sessionId: string): Promise<void> {
	const sessions = await loadSessions();
	const filtered = sessions.filter((s) => s.id !== sessionId);
	await saveSessions(filtered);
}

/**
 * Get running sessions
 */
export async function getRunningSessions(): Promise<SessionInfo[]> {
	const sessions = await loadSessions();
	return sessions.filter((s) => s.status === "running");
}

/**
 * Clean up session directory
 */
export async function cleanupSession(sessionId: string): Promise<void> {
	const sessionDir = join(RUNTIME_DIR, `session-${sessionId}`);
	await Bun.$`rm -rf ${sessionDir}`.quiet();
}

/**
 * Get the blip0 directory paths
 */
export function getPaths() {
	return {
		blip0Dir: BLIP0_DIR,
		configsDir: CONFIGS_DIR,
		runtimeDir: RUNTIME_DIR,
		sessionsFile: SESSIONS_FILE,
	};
}
