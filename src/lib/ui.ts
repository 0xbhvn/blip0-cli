import * as p from "@clack/prompts";
import color from "picocolors";

/**
 * UI utility module - centralized output formatting using @clack/prompts
 */

/**
 * Handle user cancellation (Ctrl+C)
 */
export function handleCancel(value: unknown): void {
	if (p.isCancel(value)) {
		p.cancel("Operation cancelled.");
		process.exit(0);
	}
}

/**
 * Display a styled intro banner
 */
export function intro(title: string): void {
	p.intro(color.bgCyan(color.black(` ${title} `)));
}

/**
 * Display a styled outro message
 */
export function outro(message: string): void {
	p.outro(color.green(message));
}

/**
 * Display a note box with optional title
 */
export function note(message: string, title?: string): void {
	p.note(message, title);
}

/**
 * Log variants
 */
export const log = {
	info: (message: string) => p.log.info(message),
	success: (message: string) => p.log.success(message),
	warn: (message: string) => p.log.warn(color.yellow(message)),
	error: (message: string) => p.log.error(color.red(message)),
	step: (message: string) => p.log.step(message),
	message: (message: string) => p.log.message(message),
};

/**
 * Create a spinner
 */
export function spinner(): ReturnType<typeof p.spinner> {
	return p.spinner();
}

/**
 * Display a hint/help text
 */
export function hint(message: string): void {
	p.log.message(color.dim(message));
}

/**
 * Display a divider line
 */
export function divider(width: number = 50): void {
	p.log.message(color.dim("─".repeat(width)));
}

/**
 * Format a table row with padding
 */
export function tableRow(
	columns: { value: string; width: number; color?: (s: string) => string }[],
): string {
	return columns
		.map(({ value, width, color: colorFn }) => {
			const padded = value.padEnd(width).slice(0, width);
			return colorFn ? colorFn(padded) : padded;
		})
		.join(" ");
}

/**
 * Display a simple key-value pair
 */
export function keyValue(key: string, value: string, keyWidth: number = 12): void {
	p.log.message(`  ${color.dim(key.padEnd(keyWidth))} ${value}`);
}

// Re-export prompts for convenience
export const prompts = {
	select: p.select,
	text: p.text,
	confirm: p.confirm,
	multiselect: p.multiselect,
	group: p.group,
	isCancel: p.isCancel,
};

// Re-export color for custom styling
export { color };
