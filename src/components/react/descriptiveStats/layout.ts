// Where dots sit on a DescriptiveStats axis. Pure, so scripts/check-boards.mjs checks it and setups.ts can refuse a
// setup whose dots would pile up too high on a 320px screen. Design and reasoning: decision 0015.

export interface Axis {
	min: number;
	max: number;
	/** A labeled tick every tickStep. */
	tickStep: number;
	/** On narrow boards only ticks at multiples of this keep their numbers. */
	narrowTickStep: number;
}

/** The axis width on a 320px screen: the content column, less the board's frame, padding and the dots' half-width. */
export const NARROW_AXIS_PX = 250;
/** Dots are drawn this wide; two dots closer than this on one row would touch. */
export const DOT_PX = 12;
/** Two different values closer than this at 320px can't be told apart, even when their dots step up a row. */
export const MIN_DISTINCT_PX = 5;
/** The most dots a chart row holds; the chart reserves room for all of them in one stack, so it never shifts. */
export const MAX_STACK = 10;

/** Where a value sits across the axis, in percent (outside 0–100 when it is off the axis). */
export function across(axis: Axis, value: number): number {
	return ((value - axis.min) / (axis.max - axis.min)) * 100;
}

export function ticks(axis: Axis): { value: number; narrow: boolean }[] {
	const count = Math.round((axis.max - axis.min) / axis.tickStep);
	return Array.from({ length: count + 1 }, (_, index) => {
		const value = axis.min + index * axis.tickStep;
		const steps = (value - axis.min) / axis.narrowTickStep;
		return { value, narrow: Math.abs(steps - Math.round(steps)) < 1e-9 };
	});
}

/**
 * The row each value's dot sits in (0 on the axis), in input order. Values are placed smallest first, each in the
 * lowest row where it keeps DOT_PX from every dot already there at NARROW_AXIS_PX, so ties stack and near neighbors
 * step up instead of overlapping. The layout is the same at every width, so it never jumps when the board resizes.
 */
export function stackRows(values: readonly number[], axis: Axis): number[] {
	const pixels = values.map((value) => (across(axis, value) / 100) * NARROW_AXIS_PX);
	const order = values.map((_, index) => index).sort((a, b) => values[a] - values[b] || a - b);
	const placed: number[][] = [];
	const rows: number[] = values.map(() => 0);
	for (const index of order) {
		let row = 0;
		while (placed[row]?.some((other) => Math.abs(other - pixels[index]) < DOT_PX)) row += 1;
		(placed[row] ??= []).push(pixels[index]);
		rows[index] = row;
	}
	return rows;
}

/** The closest two different values sit at 320px, with the two values, or null when there are fewer than two. */
export function closestPair(values: readonly number[], axis: Axis): { low: number; high: number; pixels: number } | null {
	const distinct = [...new Set(values)].sort((a, b) => a - b);
	let closest: { low: number; high: number; pixels: number } | null = null;
	for (let index = 1; index < distinct.length; index += 1) {
		const pixels = ((distinct[index] - distinct[index - 1]) / (axis.max - axis.min)) * NARROW_AXIS_PX;
		if (!closest || pixels < closest.pixels) closest = { low: distinct[index - 1], high: distinct[index], pixels };
	}
	return closest;
}

/** How many rows the stack needs. */
export function stackHeight(values: readonly number[], axis: Axis): number {
	return values.length === 0 ? 0 : Math.max(...stackRows(values, axis)) + 1;
}
