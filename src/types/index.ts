// User configuration stored in ~/.blip0/
export interface UserConfig {
	network: string;
	contractAddress: string;
	contractName?: string;
	threshold: string;
	notificationType: "discord" | "telegram" | "slack" | "webhook";
	webhookUrl: string;
}

// Blip0 saved configs
export interface SavedConfig {
	[toolName: string]: UserConfig;
}

// Template variables for substitution
export interface TemplateVars {
	NETWORK_SLUG: string;
	NETWORK_NAME: string;
	CONTRACT_ADDRESS: string;
	CONTRACT_NAME: string;
	THRESHOLD: string;
	WEBHOOK_URL: string;
	TRIGGER_ID: string;
	TRIGGER_TYPE: string;
	MONITOR_NAME: string;
	TELEGRAM_TOKEN?: string;
	TELEGRAM_CHAT_ID?: string;
}

// Network presets
export interface NetworkPreset {
	slug: string;
	name: string;
	type: "Stellar" | "EVM";
	rpcUrl: string;
	networkPassphrase?: string;
	chainId?: number;
	blockTimeMs: number;
	explorerUrl: string;
}

// OZ Monitor network config
export interface OZNetworkConfig {
	network_type: "Stellar" | "EVM";
	slug: string;
	name: string;
	rpc_urls: Array<{
		type_: string;
		url: { type: string; value: string };
		weight: number;
	}>;
	network_passphrase?: string;
	chain_id?: number;
	block_time_ms: number;
	confirmation_blocks: number;
	cron_schedule: string;
	max_past_blocks: number;
	store_blocks: boolean;
}

// OZ Monitor monitor config
export interface OZMonitorConfig {
	name: string;
	networks: string[];
	paused: boolean;
	addresses: Array<{ address: string }>;
	match_conditions: {
		events?: Array<{
			signature: string;
			expression?: string;
		}>;
		transactions?: Array<{
			status: string;
			expression?: string;
		}>;
	};
	triggers: string[];
}

// OZ Monitor trigger config
export interface OZTriggerConfig {
	[key: string]: {
		name: string;
		trigger_type: string;
		config: {
			discord_url?: { type: string; value: string };
			telegram_token?: { type: string; value: string };
			telegram_chat_id?: string;
			slack_url?: { type: string; value: string };
			webhook_url?: { type: string; value: string };
			message: {
				title: string;
				body: string;
			};
		};
	};
}

// Runtime session info
export interface SessionInfo {
	id: string;
	tool: string;
	configPath: string;
	pid?: number;
	containerId?: string;
	startedAt: Date;
	status: "running" | "stopped" | "error";
}
