// Names for the content scroll boxes that focusableScrollBoxes.ts makes focusable (decision 0024). Pure, so
// `npm run check:boards` pins them.

/** The name of a display formula wider than its column. Formulas share it: a group is not a landmark, so names may repeat. */
export const FORMULA_SCROLL_LABEL = 'Formula, scrolls sideways';

/** The name of a table with no header text at all. */
export const TABLE_SCROLL_FALLBACK_LABEL = 'Table, scrolls sideways';

/**
 * A table's name from its column headers, so two wide tables on one page are told apart: "Table: Mean, Median, Mode,
 * scrolls sideways". Blank headers (a markdown table's empty corner) are skipped.
 */
export function tableScrollLabel(headerTexts: readonly string[]): string {
	const headers = headerTexts.map((text) => text.replace(/\s+/g, ' ').trim()).filter((text) => text !== '');
	if (headers.length === 0) return TABLE_SCROLL_FALLBACK_LABEL;
	return `Table: ${headers.join(', ')}, scrolls sideways`;
}
