// Every sentence the page footer adds on concept pages (decision 0023), kept pure so scripts/check-boards.mjs pins
// them. The AI-use wording follows the About page's own section, which the label links to.

export const HOW_MADE_LABEL = 'How this page was made';
/** The About page's "How AI tools are used" section; check:links fails if the heading's id changes. */
export const HOW_MADE_PATH = '/about/#how-ai-tools-are-used';
export const CITE_SUMMARY = 'Cite this page';
export const CITE_DATE_NOTE = 'The date is when the page was last reviewed, so the citation names the version you read.';
export const BIBTEX_LABEL = 'BibTeX';

/** The rest of the "How this page was made" sentence, from the page's `aiAssisted` frontmatter. */
export function howMadeDetail(aiAssisted) {
	if (typeof aiAssisted !== 'boolean') throw new Error(`footer: aiAssisted must be true or false, got ${String(aiAssisted)}`);
	return aiAssisted ? 'drafted and reviewed with the help of AI tools, then checked by the author before publishing.' : 'written and checked by the author.';
}

/** The citation as it prints: the on-screen credits are hidden on paper, so the source stays on the page this way. */
export const citePrintLine = (plainCitation) => `Cite as: ${plainCitation}`;
