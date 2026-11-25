// Where the BayesTheorem board draws its four labels. Pure TypeScript with no React, so scripts/check-boards.mjs can
// assert that no label sits on the other event's fill.
import type { BayesValues } from './scenarios.ts';

/** A column narrower than this is too thin to hold its labels (the medical test's A is 0.01), so they sit beside it. */
export const NARROW_COLUMN = 0.15;
const LABEL_GAP = 0.01;
/** The column names sit just under the square's top edge. */
export const NAME_Y = 0.96;
/** Roughly half a label's height plus a little air, in square units (the board is 340px for about 1.1 units). */
export const LABEL_MARGIN = 0.04;
/** The "B and not A" label never sits lower than this inside its own strip, so a thin strip's label stays on the board. */
const STRIP_LABEL_FLOOR = 0.04;
/** Under the square, in the viewBox's bottom margin (y from −0.08 to 0). */
export const BELOW_SQUARE_Y = -0.04;

export interface LabelPosition {
	x: number;
	y: number;
	/** Set when the label sits beside a thin column: "e" draws it to the right of x, "w" to the left. */
	attach?: 'e' | 'w';
}

export interface BayesLabels {
	aName: LabelPosition;
	notAName: LabelPosition;
	bAndA: LabelPosition;
	bAndNotA: LabelPosition;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/**
 * The height for a thin column's "B and …" label, drawn beside it in the wide column. It stays level with its own
 * block where it can, but only in the wide column's free band: above that column's fill and below its name. When the
 * band is too short to hold a label, it goes under the square.
 */
function besideY(ownHeight: number, otherFill: number): number {
	const low = otherFill + LABEL_MARGIN;
	const high = NAME_Y - 2 * LABEL_MARGIN;
	if (low > high) return BELOW_SQUARE_Y;
	return clamp(ownHeight / 2, low, high);
}

export function labelPositions({ prior, likelihood, falsePositive }: BayesValues): BayesLabels {
	const thinA = prior < NARROW_COLUMN;
	const thinNotA = 1 - prior < NARROW_COLUMN;
	const besideA = { x: prior + LABEL_GAP, attach: 'e' as const };
	const besideNotA = { x: prior - LABEL_GAP, attach: 'w' as const };
	return {
		aName: thinA ? { ...besideA, y: NAME_Y } : { x: prior / 2, y: NAME_Y },
		notAName: thinNotA ? { ...besideNotA, y: NAME_Y } : { x: (prior + 1) / 2, y: NAME_Y },
		bAndA: thinA ? { ...besideA, y: besideY(likelihood, falsePositive) } : { x: prior / 2, y: likelihood / 2 },
		bAndNotA: thinNotA
			? { ...besideNotA, y: besideY(falsePositive, likelihood) }
			: { x: (prior + 1) / 2, y: Math.max(falsePositive / 2, STRIP_LABEL_FLOOR) },
	};
}
