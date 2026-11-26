// Names for the content scroll boxes that focusableScrollBoxes.ts makes focusable (decision 0024). Pure, so
// `npm run check:boards` pins them.

/** The name of a display formula wider than its column. Formulas share it: a group is not a landmark, so names may repeat. */
export const FORMULA_SCROLL_LABEL = 'Formula, scrolls sideways';

/** The name of a table with no header text and no heading. A screen reader adds "table" after the name itself. */
export const TABLE_SCROLL_FALLBACK_LABEL = 'Scrolls sideways';

/** A content table as the page shows it: its column header texts and the nearest heading above it, if any. */
export interface ContentTable {
	headers: readonly string[];
	heading: string | null;
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * A table's name from its column headers, so wide tables on one page are told apart: "Mean, Median, Mode, scrolls
 * sideways". It never says "Table": the screen reader reads the role after the name, so it would be heard twice.
 * Blank headers (a markdown table's empty corner) are skipped. `heading`, when given, leads the name.
 */
export function tableScrollLabel(headerTexts: readonly string[], heading: string | null = null): string {
	const headers = headerTexts.map(clean).filter((text) => text !== '');
	const section = heading === null ? '' : clean(heading);
	const parts = [section, headers.join(', ')].filter((part) => part !== '');
	if (parts.length === 0) return TABLE_SCROLL_FALLBACK_LABEL;
	return `${parts.join(': ')}, scrolls sideways`;
}

/**
 * Names for every content table on a page, in order. Tables whose headers repeat elsewhere on the page (a cheat
 * sheet's five "Rule, Formula, Needs" tables) are led by the nearest heading above them, so their names differ.
 */
export function tableScrollLabels(tables: readonly ContentTable[]): string[] {
	const keyOf = (table: ContentTable) => table.headers.map(clean).filter((text) => text !== '').join('\u0000');
	const counts = new Map<string, number>();
	for (const table of tables) counts.set(keyOf(table), (counts.get(keyOf(table)) ?? 0) + 1);
	return tables.map((table) => tableScrollLabel(table.headers, (counts.get(keyOf(table)) ?? 0) > 1 ? table.heading : null));
}
