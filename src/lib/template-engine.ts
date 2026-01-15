import { dirname, join } from "node:path";
import type { MatchCondition, OZMonitorConfig, TemplateVars, UserConfig } from "../types/index.js";

const TEMPLATES_DIR = join(dirname(import.meta.dir), "templates");

/**
 * Substitute template variables in a string
 */
export function substituteVars(template: string, vars: TemplateVars): string {
	let result = template;
	for (const [key, value] of Object.entries(vars)) {
		const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		result = result.replace(pattern, value);
	}
	return result;
}

/**
 * Load and process a template file
 */
export async function loadTemplate(
	category: "networks" | "monitors" | "triggers",
	name: string,
	vars?: TemplateVars,
): Promise<Record<string, unknown>> {
	const templatePath = join(TEMPLATES_DIR, category, `${name}.json`);
	const file = Bun.file(templatePath);
	const content = await file.text();

	if (vars) {
		const processed = substituteVars(content, vars);
		return JSON.parse(processed);
	}

	return JSON.parse(content);
}

/**
 * Generate a unique trigger ID
 */
export function generateTriggerId(tool: string, notificationType: string): string {
	const timestamp = Date.now();
	return `${tool}_${notificationType}_${timestamp}`;
}

/**
 * Build template variables from user config
 */
export function buildTemplateVars(
	tool: string,
	userConfig: {
		network: string;
		contractAddress: string;
		contractName?: string;
		threshold: string;
		notificationType: string;
		webhookUrl: string;
	},
	networkPreset: { slug: string; name: string },
): TemplateVars {
	const triggerId = generateTriggerId(tool, userConfig.notificationType);
	const monitorName = `${tool.charAt(0).toUpperCase() + tool.slice(1).replace("-", " ")} - ${userConfig.contractName || userConfig.contractAddress.slice(0, 8)}`;

	const vars: TemplateVars = {
		NETWORK_SLUG: networkPreset.slug,
		NETWORK_NAME: networkPreset.name,
		CONTRACT_ADDRESS: userConfig.contractAddress,
		CONTRACT_NAME: userConfig.contractName || `${userConfig.contractAddress.slice(0, 12)}...`,
		THRESHOLD: userConfig.threshold,
		WEBHOOK_URL: userConfig.webhookUrl,
		TRIGGER_ID: triggerId,
		TRIGGER_TYPE: userConfig.notificationType,
		MONITOR_NAME: monitorName,
	};

	// Parse Telegram credentials if notification type is telegram
	if (userConfig.notificationType === "telegram") {
		try {
			const telegramConfig = JSON.parse(userConfig.webhookUrl);
			vars.TELEGRAM_TOKEN = telegramConfig.token;
			vars.TELEGRAM_CHAT_ID = telegramConfig.chatId;
		} catch {
			// If parsing fails, leave them undefined
		}
	}

	return vars;
}

/**
 * Build monitor configuration dynamically based on user selections
 */
export function buildMonitorConfig(userConfig: UserConfig, vars: TemplateVars): OZMonitorConfig {
	const monitorConfig: OZMonitorConfig = {
		name: vars.MONITOR_NAME,
		networks: [vars.NETWORK_SLUG],
		paused: false,
		addresses: [{ address: vars.CONTRACT_ADDRESS }],
		match_conditions: {
			events: [],
			transactions: [],
		},
		triggers: [vars.TRIGGER_ID],
	};

	const threshold = vars.THRESHOLD;
	const monitorType = userConfig.monitorType || "events";

	if (monitorType === "events") {
		// Use selected events or fallback to default transfer
		const events = userConfig.selectedEvents?.length
			? userConfig.selectedEvents
			: [{ signature: "transfer(Address,Address,i128)" }];

		monitorConfig.match_conditions.events = events.map((event) => ({
			signature: event.signature,
			// For token transfers, index 2 is typically the amount
			expression: event.expression || `2 > ${threshold}`,
		}));
	} else if (monitorType === "functions") {
		// Use selected functions
		const functions = userConfig.selectedFunctions?.length
			? userConfig.selectedFunctions
			: [{ signature: "transfer(Address,Address,i128)" }];

		monitorConfig.match_conditions = {
			...monitorConfig.match_conditions,
			functions: functions.map((fn) => ({
				signature: fn.signature,
				expression: fn.expression || `amount > ${threshold}`,
			})),
		};
	} else if (monitorType === "transactions") {
		// Monitor all transactions with optional filter
		const txCondition = userConfig.selectedTransactions || { status: "Success" };

		monitorConfig.match_conditions.transactions = [
			{
				status: txCondition.status || "Success",
				expression: txCondition.expression || `value > ${threshold}`,
			},
		];
	}

	return monitorConfig;
}
