import { loadSessions } from "../lib/config-manager.js";
import { stopMonitor } from "../lib/runtime-manager.js";
import { hint, log, spinner } from "../lib/ui.js";

export async function stopCommand(sessionId: string): Promise<void> {
	if (!sessionId) {
		log.error("Please provide a session ID");
		hint("View running monitors with:");
		hint("  blip0 list");
		return;
	}

	const sessions = await loadSessions();
	const session = sessions.find((s) => s.id === sessionId);

	if (!session) {
		log.error(`Session not found: ${sessionId}`);
		hint("View running monitors with:");
		hint("  blip0 list");
		return;
	}

	const s = spinner();
	s.start(`Stopping ${session.tool} (${sessionId})...`);

	const success = await stopMonitor(sessionId);

	if (success) {
		s.stop(`Stopped ${session.tool}`);
		log.success(`Monitor ${sessionId} has been stopped`);
	} else {
		s.stop(`Failed to stop ${session.tool}`);
		log.error("Failed to stop monitor. It may have already stopped.");
	}
}
