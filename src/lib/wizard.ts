import type { MatchCondition, MonitorType, UserConfig } from "../types/index.js";
import { NETWORK_PRESETS } from "./config-manager.js";
import {
	type ContractEvent,
	type ContractFunction,
	type ContractSpec,
	fetchContractSpec,
	getCommonTokenEvents,
} from "./contract-inspector.js";
import { handleCancel, log, note, prompts, spinner } from "./ui.js";

/**
 * Whale Alert wizard prompts
 */
export async function whaleAlertWizard(): Promise<UserConfig> {
	// Network selection
	const network = await prompts.select({
		message: "Which network?",
		options: [
			{ value: "stellar_mainnet", label: "Stellar Mainnet" },
			{ value: "stellar_testnet", label: "Stellar Testnet" },
		],
		initialValue: "stellar_mainnet",
	});
	handleCancel(network);

	// Contract address
	const contractAddress = await prompts.text({
		message: "Contract address to watch:",
		validate: (input) => {
			if (!input.trim()) {
				return "Contract address is required";
			}
		},
	});
	handleCancel(contractAddress);

	// Contract name (optional)
	const contractName = await prompts.text({
		message: "Contract name (optional, for display):",
		placeholder: "Leave empty to skip",
	});
	handleCancel(contractName);

	// Fetch contract spec for introspection
	const introspectionResult = await fetchContractInterface(
		contractAddress as string,
		network as string,
	);

	// Select what to monitor and get selected items
	const { monitorType, selectedEvents, selectedFunctions } =
		await selectMonitorTargets(introspectionResult);

	// Alert threshold (for the expression filter)
	const threshold = await prompts.text({
		message: "Alert threshold (minimum transfer amount):",
		initialValue: "1000000",
		validate: (input) => {
			const num = parseInt(input, 10);
			if (Number.isNaN(num) || num <= 0) {
				return "Please enter a valid positive number";
			}
		},
	});
	handleCancel(threshold);

	// Notification type
	const notificationType = await prompts.select({
		message: "Where to send alerts?",
		options: [
			{ value: "discord", label: "Discord" },
			{ value: "telegram", label: "Telegram" },
			{ value: "slack", label: "Slack" },
		],
		initialValue: "discord",
	});
	handleCancel(notificationType);

	// Get webhook/bot details based on notification type
	let webhookUrl = "";

	if (notificationType === "discord") {
		const discordWebhook = await prompts.text({
			message: "Discord webhook URL:",
			validate: (input) => {
				if (!input.startsWith("https://discord.com/api/webhooks/")) {
					return "Please enter a valid Discord webhook URL";
				}
			},
		});
		handleCancel(discordWebhook);
		webhookUrl = discordWebhook as string;
	} else if (notificationType === "telegram") {
		const token = await prompts.text({
			message: "Telegram bot token:",
			validate: (input) => {
				if (!input.trim()) {
					return "Bot token is required";
				}
			},
		});
		handleCancel(token);

		const chatId = await prompts.text({
			message: "Telegram chat ID:",
			validate: (input) => {
				if (!input.trim()) {
					return "Chat ID is required";
				}
			},
		});
		handleCancel(chatId);

		// Store as JSON for telegram
		webhookUrl = JSON.stringify({
			token: token as string,
			chatId: chatId as string,
		});
	} else if (notificationType === "slack") {
		const slackWebhook = await prompts.text({
			message: "Slack webhook URL:",
			validate: (input) => {
				if (!input.startsWith("https://hooks.slack.com/")) {
					return "Please enter a valid Slack webhook URL";
				}
			},
		});
		handleCancel(slackWebhook);
		webhookUrl = slackWebhook as string;
	}

	return {
		network: network as string,
		contractAddress: contractAddress as string,
		contractName: (contractName as string) || undefined,
		threshold: threshold as string,
		notificationType: notificationType as UserConfig["notificationType"],
		webhookUrl,
		monitorType,
		selectedEvents,
		selectedFunctions,
	};
}

/**
 * Fetch contract interface with spinner
 */
async function fetchContractInterface(
	contractAddress: string,
	network: string,
): Promise<ContractSpec | null> {
	const networkPreset = NETWORK_PRESETS[network];

	// Skip for non-Stellar networks
	if (networkPreset?.type !== "Stellar") {
		return null;
	}

	const s = spinner();
	s.start("Fetching contract interface...");

	const result = await fetchContractSpec(contractAddress, network);

	if (result.success) {
		const { functions, events } = result.spec;
		s.stop(`Found ${functions.length} functions, ${events.length} events`);
		return result.spec;
	}

	s.stop(`Could not fetch contract spec: ${result.error}`);
	log.warn("Falling back to manual input or common token events");
	return null;
}

/**
 * Select what to monitor and which items
 */
async function selectMonitorTargets(spec: ContractSpec | null): Promise<{
	monitorType: MonitorType;
	selectedEvents?: MatchCondition[];
	selectedFunctions?: MatchCondition[];
}> {
	// Ask what type of monitoring
	const monitorType = await prompts.select({
		message: "What do you want to monitor?",
		options: [
			{
				value: "events",
				label: "Events",
				hint: "recommended for alerts",
			},
			{
				value: "functions",
				label: "Functions",
				hint: "contract calls",
			},
			{
				value: "transactions",
				label: "Transactions",
				hint: "all activity",
			},
		],
		initialValue: "events",
	});
	handleCancel(monitorType);

	const selectedMonitorType = monitorType as MonitorType;

	// For transactions, no further selection needed
	if (selectedMonitorType === "transactions") {
		return { monitorType: selectedMonitorType };
	}

	// Get available items based on spec or fallback
	if (selectedMonitorType === "events") {
		const events = spec?.events.length ? spec.events : getCommonTokenEvents();

		if (events.length === 0) {
			// No events found, prompt for manual input
			const manualSignature = await promptManualSignature("event");
			return {
				monitorType: selectedMonitorType,
				selectedEvents: [{ signature: manualSignature }],
			};
		}

		const selectedEventSignatures = await selectItems(events, "events");
		return {
			monitorType: selectedMonitorType,
			selectedEvents: selectedEventSignatures.map((sig) => ({ signature: sig })),
		};
	}

	// Functions
	if (spec?.functions.length) {
		const selectedFunctionSignatures = await selectItems(spec.functions, "functions");
		return {
			monitorType: selectedMonitorType,
			selectedFunctions: selectedFunctionSignatures.map((sig) => ({ signature: sig })),
		};
	}

	// No functions found, prompt for manual input
	const manualSignature = await promptManualSignature("function");
	return {
		monitorType: selectedMonitorType,
		selectedFunctions: [{ signature: manualSignature }],
	};
}

/**
 * Prompt user to select items from a list
 */
async function selectItems(
	items: (ContractFunction | ContractEvent)[],
	itemType: "events" | "functions",
): Promise<string[]> {
	const options = items.map((item) => ({
		value: item.signature,
		label: item.name,
		hint: item.doc?.slice(0, 40) || item.signature,
	}));

	const selected = await prompts.multiselect({
		message: `Select ${itemType} to monitor:`,
		options,
		required: true,
	});
	handleCancel(selected);

	return selected as string[];
}

/**
 * Prompt for manual signature input when auto-detection fails
 */
async function promptManualSignature(type: "event" | "function"): Promise<string> {
	log.warn(`No ${type}s detected. Please enter a signature manually.`);

	const example =
		type === "event" ? "transfer(Address,Address,i128)" : "transfer(Address,Address,i128)";

	const signature = await prompts.text({
		message: `Enter ${type} signature:`,
		placeholder: example,
		validate: (input) => {
			if (!input.trim()) {
				return "Signature is required";
			}
			if (!input.includes("(")) {
				return "Signature should include parameters, e.g., transfer(Address,Address,i128)";
			}
		},
	});
	handleCancel(signature);

	return signature as string;
}

/**
 * Confirm using saved config
 */
export async function confirmUseSavedConfig(tool: string): Promise<boolean> {
	const useSaved = await prompts.confirm({
		message: `Found saved ${tool} configuration. Use it?`,
		initialValue: true,
	});
	handleCancel(useSaved);
	return useSaved as boolean;
}

/**
 * Display configuration summary
 */
export function displayConfigSummary(config: UserConfig): void {
	const networkInfo = NETWORK_PRESETS[config.network];
	const summary = [
		`Network:      ${networkInfo?.name || config.network}`,
		`Contract:     ${config.contractName || config.contractAddress}`,
		`Threshold:    ${config.threshold} tokens`,
		`Alerts via:   ${config.notificationType}`,
	].join("\n");

	note(summary, "Configuration");
}

/**
 * Confirm start monitor
 */
export async function confirmStart(): Promise<boolean> {
	const confirm = await prompts.confirm({
		message: "Start the monitor now?",
		initialValue: true,
	});
	handleCancel(confirm);
	return confirm as boolean;
}
