// The pure half of PropertiesTable (decision 0023): which rows a page shows, in what order, with which example and
// link, and how a cell of prose with $…$ math becomes HTML. Every bad input throws, naming the family and the id, so a
// page can't ship a table with holes. Checked by scripts/check-boards.mjs.
import { getDistribution } from '../../data/distributions.mjs';
import { renderTex } from '../../design/renderTex.mjs';

/** @typedef {{ kind: 'text' | 'math', value: string }} Segment */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** A row link is a site path, so check:links can follow it. */
const INTERNAL_PATH = /^\/[^\s]*$/;

const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

/**
 * Splits prose at unescaped `$` into text and math segments, in order. `\$` never opens or closes math. An odd
 * number of `$` or an empty `$$` throws, naming `where`.
 * @param {string} source @param {string} where @returns {Segment[]}
 */
export function splitMath(source, where) {
	if (typeof source !== 'string' || source.trim() === '') throw new Error(`${where}: the text is empty`);
	/** @type {Segment[]} */
	const segments = [];
	let current = '';
	let inMath = false;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (character === '\\' && source[index + 1] === '$') {
			// Outside math it is a literal dollar sign; inside, TeX's own \$ stays for KaTeX.
			current += inMath ? '\\$' : '$';
			index += 1;
		} else if (character === '$') {
			if (inMath && current.trim() === '') throw new Error(`${where}: empty math "$$" in "${source}"`);
			if (current !== '') segments.push({ kind: inMath ? 'math' : 'text', value: current });
			current = '';
			inMath = !inMath;
		} else {
			current += character;
		}
	}
	if (inMath) throw new Error(`${where}: an odd number of "$" in "${source}"`);
	if (current !== '') segments.push({ kind: 'text', value: current });
	return segments;
}

/** HTML for a cell: text escaped, each math segment rendered by KaTeX with the site's macros. */
export function proseHtml(source, where) {
	return splitMath(source, where)
		.map((segment) => (segment.kind === 'math' ? renderTex(segment.value) : escapeHtml(segment.value)))
		.join('');
}

/** Ids from a record or list, checked against the shown rows. */
function checkKnownRows(ids, shown, where, what) {
	for (const id of ids) if (!shown.has(id)) throw new Error(`${where}: ${what} for row "${id}", which the table doesn't show`);
}

/**
 * The rows a page shows. `rows` picks a subset and its order (default: all). `examples` gives every shown row its
 * third-column text, or none does. `rowLinks` gives a row label an internal link.
 * @param {string} familyId
 * @param {{ rows?: string[], examples?: Record<string, string>, examplesHeading?: string, rowLinks?: Record<string, string> }} [options]
 */
export function resolveRows(familyId, { rows, examples, examplesHeading, rowLinks } = {}) {
	const family = getDistribution(familyId);
	const where = `PropertiesTable (${family.id})`;
	const byId = new Map(family.rows.map((row) => [row.id, row]));
	const order = rows ?? family.rows.map((row) => row.id);
	if (order.length === 0) throw new Error(`${where}: rows is empty; leave it out to show every row`);
	const shown = new Set();
	for (const id of order) {
		if (!byId.has(id)) throw new Error(`${where}: unknown row "${id}"`);
		if (shown.has(id)) throw new Error(`${where}: row "${id}" is listed twice`);
		shown.add(id);
	}
	const exampleIds = Object.keys(examples ?? {});
	checkKnownRows(exampleIds, shown, where, 'an example');
	checkKnownRows(Object.keys(rowLinks ?? {}), shown, where, 'a link');
	const hasExampleColumn = exampleIds.length > 0;
	if (examples !== undefined && !hasExampleColumn) throw new Error(`${where}: examples is empty; leave it out for a two-column table`);
	if (hasExampleColumn) {
		const missing = order.filter((id) => !exampleIds.includes(id));
		if (missing.length > 0) throw new Error(`${where}: examples are all or none, but rows ${missing.map((id) => `"${id}"`).join(', ')} have none`);
		if (typeof examplesHeading !== 'string' || examplesHeading.trim() === '') throw new Error(`${where}: examples need an examplesHeading`);
	} else if (examplesHeading !== undefined) {
		throw new Error(`${where}: examplesHeading is set but there are no examples`);
	}
	for (const [id, path] of Object.entries(rowLinks ?? {})) {
		if (typeof path !== 'string' || !INTERNAL_PATH.test(path)) throw new Error(`${where}: the link for row "${id}" must be a site path starting with "/", got "${path}"`);
	}
	return {
		caption: `Properties of the ${family.name} distribution`,
		statementHeading: family.statementHeading,
		examplesHeading: hasExampleColumn ? examplesHeading : undefined,
		rows: order.map((id) => {
			const { label, statement } = /** @type {import('../../data/distributions.mjs').PropertyRow} */ (byId.get(id));
			const example = examples?.[id];
			splitMath(label, `${where}, row "${id}" label`);
			splitMath(statement, `${where}, row "${id}"`);
			if (hasExampleColumn) splitMath(/** @type {string} */ (example), `${where}, example for row "${id}"`);
			return { id, label, statement, example, link: rowLinks?.[id] };
		}),
	};
}
