import type { UserConfig } from "../types/index.js";
import { NETWORK_PRESETS } from "./config-manager.js";
import { handleCancel, note, prompts } from "./ui.js";

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
			{ value: "ethereum_mainnet", label: "Ethereum Mainnet" },
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

	// Alert threshold
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
	};
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
