// The stale-commit rule every board slider shares. A slider announces its new value only after a pause (or when a
// drag ends), so by then the reader may have pressed a button or moved another slider, whose answer must not be
// talked over. Pure, so scripts/check-boards.mjs checks it; useCommittedSlider.ts holds one per board.

export interface SliderGuard<K extends string> {
	/** A slider moved: it is now the last thing the reader changed. */
	moved(key: K): void;
	/** Anything else happened (a button, a radio, Reset): no pending slider commit may speak. */
	interrupt(): void;
	/**
	 * Called from a slider's commit. True, once, when that slider was the last thing moved and the board still holds
	 * the committed value; the caller then announces. Every commit source (keyboard pause, drag end, pointer strip)
	 * must go through here.
	 */
	take(key: K, stillHolds: boolean): boolean;
}

export function createSliderGuard<K extends string>(): SliderGuard<K> {
	let moving: K | null = null;
	return {
		moved(key) {
			moving = key;
		},
		interrupt() {
			moving = null;
		},
		take(key, stillHolds) {
			if (moving !== key || !stillHolds) return false;
			moving = null;
			return true;
		},
	};
}
