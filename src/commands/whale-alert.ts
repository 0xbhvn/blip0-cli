import {
	createSessionDir,
	loadUserConfig,
	NETWORK_PRESETS,
	saveUserConfig,
	writeOZConfigs,
} from "../lib/config-manager.js";
import { generateSessionId, startMonitor } from "../lib/runtime-manager.js";
import { buildTemplateVars, loadTemplate } from "../lib/template-engine.js";
import { hint, intro, log, note, outro, spinner } from "../lib/ui.js";
import {
	confirmStart,
	confirmUseSavedConfig,
	displayConfigSummary,
	whaleAlertWizard,
} from "../lib/wizard.js";

const TOOL_NAME = "whale-alert";

interface WhaleAlertOptions {
	reconfigure?: boolean;
	network?: string;
	threshold?: string;
	contract?: string;
}

export async function whaleAlertCommand(options: WhaleAlertOptions): Promise<void> {
	intro("Whale Alert - Large Transfer Monitor");

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
		log.success("Configuration saved!");
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
		log.warn("Monitor not started. Run again when ready.");
		return;
	}

	// Generate OZ Monitor configs
	const s = spinner();
	s.start("Generating configuration...");

	try {
		const networkPreset = NETWORK_PRESETS[config.network];
		if (!networkPreset) {
			s.stop(`Unknown network: ${config.network}`);
			return;
		}

		// Build template variables
		const vars = buildTemplateVars(TOOL_NAME, config, networkPreset);

		// Load and process templates
		const networkConfig = await loadTemplate("networks", networkPreset.slug);
		const monitorConfig = await loadTemplate("monitors", "whale_alert", vars);
		const triggerConfig = await loadTemplate("triggers", config.notificationType, vars);

		// Create session directory and write configs
		const sessionId = generateSessionId();
		const sessionDir = await createSessionDir(sessionId);
		await writeOZConfigs(sessionDir, networkConfig, monitorConfig, triggerConfig);

		s.stop("Configuration generated");

		// Start the monitor
		s.start("Starting OpenZeppelin Monitor...");
		const session = await startMonitor(sessionDir, TOOL_NAME, sessionId);

		if (session) {
			s.stop("Monitor started");

			// Display session info in a note box
			const sessionInfo = [
				`Session ID:  ${session.id}`,
				`Watching:    transfers > ${config.threshold} tokens`,
				`Network:     ${networkPreset.name}`,
			].join("\n");
			note(sessionInfo, "Whale Alert is running!");

			// Show available commands
			hint("Commands:");
			hint(`  blip0 list              View running monitors`);
			hint(`  blip0 stop ${session.id}   Stop this monitor`);

			outro("Monitor is active");
		} else {
			s.stop("Failed to start monitor");
			log.error("Failed to start monitor. Check logs for details.");
		}
	} catch (error) {
		s.stop("Failed to generate configuration");
		log.error(`Error: ${error}`);
	}
}
