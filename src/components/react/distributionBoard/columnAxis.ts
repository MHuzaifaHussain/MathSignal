// Where things sit on DistributionBoard's column charts (family and density modes, decision 0018). Pure, so
// scripts/check-boards.mjs checks the spacing rule.

/** The narrowest a column may be at a 320 px viewport. */
export const MIN_COLUMN_PX = 14;
/**
 * Any nonzero chance draws at least this tall, so a tiny bar never vanishes. components.css applies it as
 * --ms-cols-stub; scripts/check-boards.mjs keeps the two equal.
 */
export const MIN_VISIBLE_PX = 2;
/**
 * A column narrower than this gets a label only on every second value. components.css's tick-thinning container
 * query is the gutter plus the family axis's columns at this width; scripts/check-boards.mjs checks the sum.
 */
export const MIN_LABELED_COLUMN_PX = 24;
/**
 * The column area's width at a 320 px viewport: the chart measured 270 px on the lab page, less the 28 px gridline
 * gutter.
 */
export const NARROWEST_CHART_PX = 242;

/** The middle of a value's column, in percent, with half a column of margin each side: [first − 1/2, last + 1/2]. */
export function across(value: number, first: number, last: number): number {
	return ((value - first + 0.5) / (last - first + 1)) * 100;
}

/** A column's height as a percent of the chart, against the setup's fixed scale. */
export function columnHeight(probability: number, yMax: number): number {
	if (probability < 0 || probability > yMax) throw new Error(`columnHeight: ${probability} is outside the scale 0 to ${yMax}`);
	return (probability / yMax) * 100;
}

/** Throws, naming the setup, when its columns would be narrower than MIN_COLUMN_PX at 320 px. */
export function fitsAt320(columns: number, setupId: string): void {
	if (columns * MIN_COLUMN_PX > NARROWEST_CHART_PX) {
		throw new Error(`DistributionBoard: setup "${setupId}" has ${columns} columns, more than fit at 320 px (${MIN_COLUMN_PX} px each in ${NARROWEST_CHART_PX} px).`);
	}
}

/** 1 when every column is wide enough to carry its label at 320 px, else 2 (every second value). */
export function tickEvery(columns: number): 1 | 2 {
	return NARROWEST_CHART_PX / columns >= MIN_LABELED_COLUMN_PX ? 1 : 2;
}
