import { loadSessions } from "../lib/config-manager.js";
import { isSessionRunning } from "../lib/runtime-manager.js";
import { color, divider, hint, intro, log, tableRow } from "../lib/ui.js";

export async function listCommand(): Promise<void> {
	intro("Running Monitors");

	const sessions = await loadSessions();

	if (sessions.length === 0) {
		log.message("No monitors running.");
		hint("Start one with:");
		hint("  blip0 whale-alert");
		return;
	}

	// Table header
	divider(70);
	log.message(
		tableRow([
			{ value: "ID", width: 12, color: color.white },
			{ value: "Tool", width: 16, color: color.white },
			{ value: "Status", width: 12, color: color.white },
			{ value: "Started", width: 24, color: color.white },
		]),
	);
	divider(70);

	// Table rows
	for (const session of sessions) {
		const isRunning = await isSessionRunning(session.id);
		const status = isRunning ? "running" : "stopped";
		const statusColor = isRunning ? color.green : color.red;
		const startedAt = new Date(session.startedAt).toLocaleString();

		log.message(
			tableRow([
				{ value: session.id, width: 12, color: color.cyan },
				{ value: session.tool, width: 16 },
				{ value: status, width: 12, color: statusColor },
				{ value: startedAt, width: 24, color: color.dim },
			]),
		);
	}

	divider(70);

	// Help hint
	hint("Stop a monitor with:");
	hint("  blip0 stop <session-id>");
}
