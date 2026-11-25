// "Cite this page" text for the page footer (decision 0023): a plain citation (author, date, title, site, URL) and a
// BibTeX entry, both built from frontmatter the concept pages already require. Pure, so scripts/check-boards.mjs pins
// every string. The date is the page's `reviewedAt`, read in UTC, so the citation names the version the reader saw.
import { AUTHOR_NAME, SITE_NAME } from './site.mjs';

/**
 * Authors as citations need them. Names are data, not parsed from the display name: splitting "Muhammad Huzaifa
 * Hussain" by guesswork goes wrong on multi-part family names.
 * @type {Readonly<Record<string, { family: string, given: string, initials: string }>>}
 */
export const AUTHORS = {
	[AUTHOR_NAME]: { family: 'Hussain', given: 'Muhammad Huzaifa', initials: 'M. H.' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** BibTeX's built-in month macros, written bare (`month = nov`). */
const BIBTEX_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Site URLs are plain paths; anything else would need BibTeX URL escaping, so it fails instead. */
const PLAIN_URL = /^https:\/\/[A-Za-z0-9./:-]+$/;
const BIBTEX_SPECIAL = /[\\{}%&$#_~^]/g;
const BIBTEX_ESCAPES = {
	'\\': '\\textbackslash{}',
	'{': '\\{',
	'}': '\\}',
	'%': '\\%',
	'&': '\\&',
	$: '\\$',
	'#': '\\#',
	_: '\\_',
	'~': '\\textasciitilde{}',
	'^': '\\textasciicircum{}',
};
/** Field names are padded to the longest one, so the `=` signs line up. */
const BIBTEX_FIELD_WIDTH = 'howpublished'.length;

/** The citation names of a display name, or an error naming it. */
export function authorName(display) {
	const author = Object.hasOwn(AUTHORS, display) ? AUTHORS[display] : undefined;
	if (!author) throw new Error(`citation: unknown author "${display}"; add it to AUTHORS in src/seo/citation.mjs`);
	return author;
}

/** A stable BibTeX key from a route id: "probability/independence" → "mathsignal-probability-independence". */
export function citationKey(routeId) {
	if (typeof routeId !== 'string' || routeId === '') throw new Error('citation: a citation key needs a route id');
	return `mathsignal-${routeId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

/** Escapes text for a BibTeX field in one pass, so a replacement is never escaped again. */
export function escapeBibtex(text) {
	return text.replace(BIBTEX_SPECIAL, (character) => BIBTEX_ESCAPES[character]);
}

/** Year, month and day in UTC, so the date never shifts with the builder's time zone. */
function reviewedParts(reviewedAt) {
	if (!(reviewedAt instanceof Date) || Number.isNaN(reviewedAt.getTime())) throw new Error(`citation: reviewedAt must be a valid date, got ${String(reviewedAt)}`);
	return { year: reviewedAt.getUTCFullYear(), month: reviewedAt.getUTCMonth(), day: reviewedAt.getUTCDate() };
}

/** "November 25, 2026": the footer's own date format. */
export function reviewedDateText(reviewedAt) {
	const { year, month, day } = reviewedParts(reviewedAt);
	return `${MONTH_NAMES[month]} ${day}, ${year}`;
}

function checkedFields({ author, title, reviewedAt, url }) {
	if (typeof title !== 'string' || title.trim() === '') throw new Error('citation: the page needs a title');
	if (typeof url !== 'string' || !PLAIN_URL.test(url)) throw new Error(`citation: "${url}" is not a plain https site URL`);
	return { names: authorName(author), title: title.trim(), date: reviewedParts(reviewedAt), url };
}

/** "Hussain, M. H. (2026, November 25). Title. MathSignal. https://…/": author, date, title, site, URL. */
export function plainCitation(page) {
	const { names, title, date, url } = checkedFields(page);
	return `${names.family}, ${names.initials} (${date.year}, ${MONTH_NAMES[date.month]} ${date.day}). ${title}. ${SITE_NAME}. ${url}`;
}

/** An @misc entry. The title sits in double braces so citation styles keep its capitals ("Bayes"). */
export function bibtexEntry({ routeId, ...page }) {
	const { names, title, date, url } = checkedFields(page);
	const isoDate = `${date.year}-${String(date.month + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
	const fields = [
		['author', `{${escapeBibtex(`${names.family}, ${names.given}`)}}`],
		['title', `{{${escapeBibtex(title)}}}`],
		['howpublished', `{${escapeBibtex(SITE_NAME)}}`],
		['year', `{${date.year}}`],
		['month', BIBTEX_MONTHS[date.month]],
		['url', `{${url}}`],
		['note', `{Last reviewed ${isoDate}}`],
	];
	const body = fields.map(([name, value]) => `  ${name.padEnd(BIBTEX_FIELD_WIDTH)} = ${value}`).join(',\n');
	return `@misc{${citationKey(routeId)},\n${body}\n}`;
}
