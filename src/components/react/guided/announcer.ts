// The live-region pattern every board uses, without React, so scripts/check-boards.mjs checks its timing with a
// fake clock. useAnnouncer.ts wraps it for the boards. Design and reasoning: decision 0013.

/** Gap between emptying and refilling the live region, so a repeated message is spoken again. */
export const REANNOUNCE_GAP_MS = 50;

export interface Clock {
	setTimeout(run: () => void, ms: number): number;
	clearTimeout(id: number | undefined): void;
}

export interface Announcer {
	/**
	 * Says `text` after `delayMs`, even when it matches the last message. A newer call replaces one still waiting,
	 * so a burst of key presses is spoken once, after its pause.
	 */
	announce(text: string, delayMs?: number): void;
	/** Drops whatever is still waiting, for unmount. */
	cancel(): void;
}

export function createAnnouncer(show: (text: string) => void, clock: Clock): Announcer {
	let waiting: number | undefined;
	let refill: number | undefined;
	const cancel = () => {
		clock.clearTimeout(waiting);
		clock.clearTimeout(refill);
		waiting = undefined;
		refill = undefined;
	};
	const announce = (text: string, delayMs = 0) => {
		cancel();
		waiting = clock.setTimeout(() => {
			// Empty the region first, then fill it a moment later, so screen readers treat it as new text.
			show('');
			refill = clock.setTimeout(() => show(text), REANNOUNCE_GAP_MS);
		}, delayMs);
	};
	return { announce, cancel };
}
