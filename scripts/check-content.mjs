// Verifies the content registries and the ids pages use (decision 0009), before every build:
//   - topics: unique ids, every prerequisite / leadsTo id exists, no prerequisite cycles,
//     prerequisites and leadsTo agree in both directions, and a topic's status matches its page:
//     published = a page that isn't a draft, planned = no page yet or a draft
//   - notation and references: unique ids; every reference has an https URL and a `checked` date, and lists
//     `surnames` when an author's name has a particle ("de Amorim"), so short citations keep it
//   - pages: every topic, reference, <Cite id> and <NotationKey symbols> id they use exists
//   - distributions: a family's owner page, once it exists, shows <PropertiesTable family="…">; every table names a
//     known family; a page with several tables gives all but one an `id` (decision 0023)
//   - SEO: descriptions 120-160 characters; titles, descriptions and primary queries unique (docs/seo/README.md);
//     searchIntent matches the page type
//   - spelling: page prose uses American English (decision 0010)
//   - length: each concept page's reader-prose word count (visible prose on A and B pages), printed, and held to its
//     type's limits when complete
// Frontmatter is parsed the way Astro parses it (the `yaml` package, core schema), so `draft: True`, comments,
// quoting and multi-line values mean the same here as in the build.
// Required frontmatter on concept pages is enforced during the build by src/routeData.ts.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { TOPICS } from '../src/data/topics.mjs';
import { NOTATION } from '../src/data/notation.mjs';
import { DISTRIBUTIONS } from '../src/data/distributions.mjs';
import { REFERENCES, shortCitation } from '../src/data/references.mjs';
import { SITE_NAME } from '../src/seo/site.mjs';

const DOCS_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const PAGE_EXTENSION = /\.mdx?$/;
// Astro's own frontmatter pattern (@astrojs/internal-helpers): an optional BOM or leading blank lines, then ---.
const FRONTMATTER = /^(?:﻿?|\s*\n)---\r?\n([\s\S]*?\r?\n)?---/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// From docs/seo/README.md. Starlight appends " | MathSignal" to every page title.
const DESCRIPTION_LENGTH = { min: 120, max: 160 };
const MAX_FULL_TITLE_LENGTH = 60;
const TITLE_SUFFIX = ` | ${SITE_NAME}`;
// Each page type owns one kind of search intent (docs/design-system/writing-a-concept-page.md).
const INTENT_FOR_TYPE = { A: 'learn', B: 'learn', C: 'solve', D: 'compare', E: 'apply', F: 'reference' };
// The site is written in American English (decision 0010). British forms that slip in most often; -ise verbs are
// listed by stem because many correct words end in -ise (promise, noise, precise, exercise).
const BRITISH_SPELLING =
	/\b(maths|colour\w*|centre[sd]?|behaviour\w*|favour\w*|rigour|grey|licence[sd]?|towards|afterwards|whilst|amongst|learnt|spelt|programme[sd]?|catalogue[sd]?|judgement[sd]?|modelling|modelled|labelled|labelling|travelled|cancelled|analys(?:e|ed|ing)|\w+isations?|(?:initial|normal|standard|optim|recogn|summar|organ|visual|real|minim|maxim|emphas|special|general|categor|util|parameter|regular|serial|character|vector|token|random|penal|stabil)is(?:e|ed|es|ing))\b/gi;

/** @param {{ id?: string, key?: string }[]} items @param {'id' | 'key'} field @param {string} name */
function duplicateIds(items, field, name) {
	const seen = new Set();
	return items.flatMap((item) => {
		const value = item[field];
		if (seen.has(value)) return [`${name}: duplicate ${field} "${value}"`];
		seen.add(value);
		return [];
	});
}

function topicProblems(pagesById) {
	const byId = new Map(TOPICS.map((topic) => [topic.id, topic]));
	const problems = duplicateIds(TOPICS, 'id', 'topics.mjs');
	for (const topic of TOPICS) {
		for (const field of ['prerequisites', 'leadsTo']) {
			for (const id of topic[field]) {
				if (!byId.has(id)) problems.push(`topics.mjs: "${topic.id}" lists unknown ${field} id "${id}"`);
			}
		}
		for (const id of topic.leadsTo) {
			if (byId.get(id) && !byId.get(id).prerequisites.includes(topic.id)) {
				problems.push(`topics.mjs: "${topic.id}" leads to "${id}", but "${id}" doesn't list it as a prerequisite`);
			}
		}
		problems.push(...releaseProblems(topic, pagesById.get(topic.id)));
	}
	problems.push(...prerequisiteCycles(byId));
	return problems;
}

/**
 * A topic's status and its page's `draft` flag must agree, because other pages link to a topic only when it is
 * published: published means the page exists and is not a draft; planned means there is no page yet, or a draft.
 * Pages are merged as drafts and released by flipping both together.
 */
function releaseProblems(topic, page) {
	const isDraft = page?.data.draft === true;
	if (topic.status === 'published' && !page) return [`topics.mjs: "${topic.id}" is marked published but no page exists at src/content/docs/${topic.id}.mdx`];
	if (topic.status === 'published' && isDraft) return [`topics.mjs: "${topic.id}" is marked published but ${page.name} has \`draft: true\`; release both together`];
	if (topic.status === 'planned' && page && !isDraft) return [`topics.mjs: "${topic.id}" is still planned but ${page.name} is not a draft; set status 'published' or add \`draft: true\``];
	return [];
}

/** Depth-first search for cycles in the prerequisite graph. */
function prerequisiteCycles(byId) {
	const state = new Map(); // id -> 'visiting' | 'done'
	const cycles = [];
	const visit = (id, path) => {
		if (state.get(id) === 'done' || !byId.has(id)) return;
		if (state.get(id) === 'visiting') {
			cycles.push(`topics.mjs: prerequisite cycle ${[...path.slice(path.indexOf(id)), id].join(' -> ')}`);
			return;
		}
		state.set(id, 'visiting');
		for (const next of byId.get(id).prerequisites) visit(next, [...path, id]);
		state.set(id, 'done');
	};
	for (const id of byId.keys()) visit(id, []);
	return cycles;
}

function referenceProblems() {
	const problems = duplicateIds(REFERENCES, 'id', 'references.mjs');
	for (const reference of REFERENCES) {
		if (!reference.url?.startsWith('https://')) problems.push(`references.mjs: "${reference.id}" needs an https URL`);
		if (!ISO_DATE.test(reference.checked ?? '')) problems.push(`references.mjs: "${reference.id}" needs a \`checked\` date (YYYY-MM-DD), set when the source was opened`);
		if (!reference.authors?.length || !reference.title || !reference.year) problems.push(`references.mjs: "${reference.id}" needs authors, title and year`);
		else problems.push(...surnameProblems(reference));
	}
	return problems;
}

/** A lowercase word before the last one is a surname particle: "Lucas B. V. de Amorim", "Rob van der Goot". */
const hasParticle = (name) => name.split(' ').slice(0, -1).some((word) => /^\p{Ll}/u.test(word));

/** `surnames` must name every author's surname, in order, and is required when a name has a particle. */
function surnameProblems(reference) {
	const { id, authors, surnames } = reference;
	if (surnames === undefined) {
		const unmarked = authors.filter(hasParticle);
		if (unmarked.length === 0) return [];
		return [`references.mjs: "${id}" needs \`surnames\`, because ${unmarked.map((name) => `"${name}"`).join(', ')} has a particle`];
	}
	if (!Array.isArray(surnames) || surnames.length !== authors.length) return [`references.mjs: "${id}" needs one surname per author in \`surnames\``];
	return authors.flatMap((name, index) => (name === surnames[index] || name.endsWith(` ${surnames[index]}`) ? [] : [`references.mjs: "${id}": "${surnames[index]}" is not the end of "${name}"`]));
}

/** Short citations keep surname particles, and the surname rule catches a particle with no `surnames`. */
function checkCitationRules() {
	const base = { id: 'example', year: 2005, title: 'A title', url: 'https://example.org', checked: '2026-11-25' };
	const vonHippel = { ...base, authors: ['Paul T. von Hippel'], surnames: ['von Hippel'] };
	const deAmorim = { ...base, year: 2022, authors: ['Lucas B. V. de Amorim', 'George D. C. Cavalcanti', 'Rafael M. O. Cruz'], surnames: ['de Amorim', 'Cavalcanti', 'Cruz'] };
	assert.equal(shortCitation(vonHippel), 'von Hippel 2005');
	assert.equal(shortCitation(deAmorim), 'de Amorim et al. 2022');
	assert.equal(shortCitation({ ...base, authors: ['Rik van Noord', 'Rob van der Goot'], surnames: ['van Noord', 'van der Goot'] }), 'van Noord and van der Goot 2005');
	assert.equal(shortCitation({ ...base, year: 2010, authors: ['Xavier Glorot', 'Yoshua Bengio'] }), 'Glorot and Bengio 2010');
	assert.equal(shortCitation({ ...base, authors: ['scikit-learn'] }), 'scikit-learn 2005');
	assert.deepEqual(surnameProblems(vonHippel), []);
	assert.deepEqual(surnameProblems(deAmorim), []);
	assert.equal(surnameProblems({ ...vonHippel, surnames: undefined }).length, 1);
	assert.equal(surnameProblems({ ...vonHippel, surnames: ['Hippel von'] }).length, 1);
	assert.equal(surnameProblems({ ...deAmorim, surnames: ['de Amorim'] }).length, 1);
}

async function pageFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => (entry.isDirectory() ? pageFiles(join(directory, entry.name)) : PAGE_EXTENSION.test(entry.name) ? [join(directory, entry.name)] : [])),
	);
	return files.flat();
}

/** The route id Starlight gives a file: statistics/clt.mdx and statistics/clt/index.md are both statistics/clt. */
function routeIdOf(name) {
	return name.replace(PAGE_EXTENSION, '').replace(/(^|\/)index$/, '');
}

/** The frontmatter as Astro reads it, or a parse error to report. */
function parseFrontmatter(source) {
	const yamlSource = source.match(FRONTMATTER)?.[1] ?? '';
	const document = parseDocument(yamlSource, { customTags: ['timestamp'], merge: true, schema: 'core' });
	if (document.errors.length > 0) return { data: {}, error: document.errors[0].message };
	const data = document.toJS();
	return { data: data && typeof data === 'object' ? data : {}, error: null };
}

/** Every page once: its file path under src/content/docs, its route id, its source and its parsed frontmatter. */
async function readPages() {
	return Promise.all(
		(await pageFiles(DOCS_DIR)).map(async (file) => {
			// LF whatever the checkout: paragraph breaks are found by searching for '\n\n'.
			const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
			const name = relative(DOCS_DIR, file).replace(/\\/g, '/');
			return { name, id: routeIdOf(name), source, ...parseFrontmatter(source) };
		}),
	);
}

/** A frontmatter field as a list of strings, whatever YAML shape it was written in. */
function stringList(value) {
	if (value === undefined || value === null) return [];
	return (Array.isArray(value) ? value : [value]).map(String);
}

function pageProblems(pages) {
	const topicIds = new Set(TOPICS.map((topic) => topic.id));
	const referenceIds = new Set(REFERENCES.map((reference) => reference.id));
	const notationKeys = new Set(NOTATION.map((entry) => entry.key));
	const problems = [];
	for (const { name, source, data, error } of pages) {
		if (error) {
			problems.push(`${name}: frontmatter is not valid YAML (${error})`);
			continue;
		}
		const frontmatterReferences = stringList(data.references);
		const cited = [...source.matchAll(/<Cite\s+id=["']([^"']+)["']/g)].map((match) => match[1]);
		const symbols = [...source.matchAll(/<NotationKey\s+symbols=\{\[([^\]]*)\]\}/g)].flatMap((match) => [...match[1].matchAll(/["']([^"']+)["']/g)].map((symbol) => symbol[1]));
		if (data.topic !== undefined && !topicIds.has(String(data.topic))) problems.push(`${name}: unknown topic "${data.topic}"`);
		for (const id of [...frontmatterReferences, ...cited]) {
			if (!referenceIds.has(id)) problems.push(`${name}: unknown reference "${id}"`);
		}
		for (const id of cited) {
			if (!frontmatterReferences.includes(id)) problems.push(`${name}: <Cite id="${id}"> is not listed in frontmatter \`references\``);
		}
		for (const key of symbols) {
			if (!notationKeys.has(key)) problems.push(`${name}: unknown notation key "${key}"`);
		}
	}
	return problems;
}

/** A frontmatter value as trimmed text, or undefined when it is missing or not a string. */
function text(value) {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * The SEO rules in docs/seo/README.md that a script can check: descriptions are 120-160 characters, and no two
 * pages share a title, a description or a primary query. The ~60-character <title> limit is a guide, so it warns.
 */
function seoProblems(pages) {
	const problems = [];
	const warnings = [];
	const seen = { title: new Map(), description: new Map(), primaryQuery: new Map() };
	for (const { name, data, error } of pages) {
		if (error) continue;
		const values = Object.fromEntries(Object.keys(seen).map((field) => [field, text(data[field])]));
		if (!values.description) problems.push(`${name}: needs a description`);
		else if (values.description.length < DESCRIPTION_LENGTH.min || values.description.length > DESCRIPTION_LENGTH.max) {
			problems.push(`${name}: description is ${values.description.length} characters; keep it ${DESCRIPTION_LENGTH.min}-${DESCRIPTION_LENGTH.max}`);
		}
		const fullTitle = `${values.title}${TITLE_SUFFIX}`;
		if (values.title && fullTitle.length > MAX_FULL_TITLE_LENGTH) {
			warnings.push(`${name}: "${fullTitle}" is ${fullTitle.length} characters; aim for ${MAX_FULL_TITLE_LENGTH} or fewer`);
		}
		for (const [field, owners] of Object.entries(seen)) {
			const value = values[field]?.toLowerCase();
			if (!value) continue;
			if (owners.has(value)) problems.push(`${name}: same ${field} as ${owners.get(value)} ("${values[field]}")`);
			else owners.set(value, name);
		}
	}
	return { problems, warnings };
}

/** Page prose without code, URLs and imports, where spelling rules don't apply. */
function proseOf(source) {
	return source
		.replace(/```[\s\S]*?```/g, '')
		.replace(/code=\{`[\s\S]*?`\}/g, '')
		.replace(/`[^`\n]*`/g, '')
		.replace(/https?:\/\/\S+/g, '')
		.replace(/^import .*$/gm, '');
}

function spellingProblems(pages) {
	return pages.flatMap(({ name, source }) => {
		const found = [...new Set([...proseOf(source).matchAll(BRITISH_SPELLING)].map((match) => match[0]))];
		return found.length > 0 ? [`${name}: British spelling ${found.map((word) => `"${word}"`).join(', ')}; the site uses American English (decision 0010)`] : [];
	});
}

/** The source with fenced code, code props and inline code blanked to spaces, so match indices still point into it. */
function blankCode(source) {
	const blank = (match) => match.replace(/[^\n]/g, ' ');
	return source
		.replace(/```[\s\S]*?```/g, blank)
		.replace(/code=\{`[\s\S]*?`\}/g, blank)
		.replace(/`[^`\n]*`/g, blank);
}

/** The PropertiesTable elements on a page, with their string attributes; a tag written as code in prose isn't one. */
function propertiesTablesOf(source) {
	return [...blankCode(source).matchAll(/<PropertiesTable\b/g)].map((match) => Object.fromEntries(readTag(source, match.index).attributes));
}

/** Owner pages show their family's table; table ids never collide; every family id exists (decision 0023). */
function propertiesTableProblems(pages) {
	const familyIds = new Set(DISTRIBUTIONS.map((family) => family.id));
	const problems = [];
	const byId = new Map(pages.map((page) => [page.id, page]));
	for (const family of DISTRIBUTIONS) {
		const owner = byId.get(family.ownerTopic);
		if (!owner) continue;
		if (!propertiesTablesOf(owner.source).some((table) => table.family === family.id)) {
			problems.push(`${owner.name}: owns the ${family.id} family, so it must show <PropertiesTable family="${family.id}" /> (src/data/distributions.mjs)`);
		}
	}
	for (const { name, source } of pages) {
		const tables = propertiesTablesOf(source);
		for (const table of tables) {
			if (!familyIds.has(table.family)) problems.push(`${name}: <PropertiesTable family="${table.family}"> names no family in src/data/distributions.mjs (family must be a quoted id)`);
		}
		const defaultIdCount = tables.filter((table) => table.id === undefined).length;
		if (defaultIdCount > 1) problems.push(`${name}: ${defaultIdCount} PropertiesTables share the default id "properties"; give all but one their own id`);
	}
	return problems;
}

/** Pins the PropertiesTable rules on made-up pages, so a change to them fails loudly. */
function checkPropertiesTableRules() {
	const page = (id, source) => ({ name: `${id}.mdx`, id, source });
	const owner = 'probability/binomial-distribution';
	const examples = '<PropertiesTable family="binomial" examplesHeading="On the boards" examples={{ needs: "Without replacement: $1/15$, not $0 < p$" }} rows={["needs"]} />';
	assert.deepEqual(propertiesTableProblems([page(owner, `Text.\n\n${examples}\n`)]), []);
	assert.deepEqual(propertiesTableProblems([page(owner, 'A hand-written table instead.\n')]), [
		`${owner}.mdx: owns the binomial family, so it must show <PropertiesTable family="binomial" /> (src/data/distributions.mjs)`,
	]);
	assert.deepEqual(propertiesTableProblems([page('a/b', '<PropertiesTable family="gamma" />')]), [
		'a/b.mdx: <PropertiesTable family="gamma"> names no family in src/data/distributions.mjs (family must be a quoted id)',
	]);
	assert.deepEqual(propertiesTableProblems([page('a/b', '<PropertiesTable family="normal" />\n\n<PropertiesTable family="uniform" />')]), [
		'a/b.mdx: 2 PropertiesTables share the default id "properties"; give all but one their own id',
	]);
	assert.deepEqual(propertiesTableProblems([page('a/b', '<PropertiesTable family="normal" />\n\n<PropertiesTable family="uniform" id="uniform-properties" />')]), []);
	assert.deepEqual(propertiesTableProblems([page('a/b', '<PropertiesTable family="normal" />\n\n<PropertiesTable family="uniform" />\n\n<PropertiesTable family="binomial" id="binomial-properties" />')]), [
		'a/b.mdx: 2 PropertiesTables share the default id "properties"; give all but one their own id',
	]);
	assert.deepEqual(propertiesTableProblems([page('a/b', 'Write `<PropertiesTable family="gamma" />` once.\n\n```mdx\n<PropertiesTable family="normal" />\n```\n\n<PropertiesTable family="normal" />')]), []);
}

function intentProblems(pages) {
	return pages.flatMap(({ name, data, error }) => {
		const type = text(data.type);
		const intent = text(data.searchIntent);
		if (error || !type || !intent || INTENT_FOR_TYPE[type] === intent) return [];
		return [`${name}: a type ${type} page has searchIntent "${INTENT_FOR_TYPE[type] ?? '(unknown type)'}", not "${intent}"`];
	});
}

// ---- Reader-prose word count (owner rulings, 2026-11-25; rules in docs/design-system/writing-a-concept-page.md) ----
// A page type's word limits count what a reader reads, nothing else. Left out: frontmatter, imports, code (fences,
// inline code and PyRunner), tables (markdown and HTML), the reference list, CheckYourself answers, and JSX tags
// with their attributes. Every formula, display or inline, counts as one word. The prose children of components
// count (SideNote, Mistake, Analogy, WorkedExample, StepThrough, WhyThisMatters and any new one), and so do the
// attributes in PROSE_ATTRIBUTES, which a reader reads as sentences. Two modes:
//   - `all`: the spine and every fold. C to F pages are held to it.
//   - `visible`: what shows with every fold closed. A and B pages are held to it. The folds (Fold, Simpler and
//     GoDeeper, with the proofs inside them), PreciseStatement, FormalDefinition and ResearchFrontier are left out,
//     since they have their own caps. A Fold with `open` is left out too; no page opens one by default.

/** The two ways of counting: the spine plus every fold, or only the prose a reader sees with every fold closed. */
export const WORD_COUNT_MODES = ['all', 'visible'];

/**
 * Word limits by page type, enforced on pages with `depthStatus: complete`, and the mode each type is counted in.
 * C to F are the content plan's satellite range (§4), over spine and folds. A and B take the plan's 1,500 to 3,000
 * visible words. F is a reference page made mostly of tables, so it has a cap and no floor.
 */
export const WORD_LIMITS = {
	A: { min: 1500, max: 3000, mode: 'visible' },
	B: { min: 1500, max: 3000, mode: 'visible' },
	C: { min: 1200, max: 2500, mode: 'all' },
	D: { min: 1200, max: 2500, mode: 'all' },
	E: { min: 1200, max: 2500, mode: 'all' },
	F: { min: 0, max: 2500, mode: 'all' },
};

/**
 * Pages written before the counter existed that fall outside their type's limits, with the count measured in their
 * type's mode (re-measured 2026-11-25 when A and B moved to visible prose). They warn instead of failing, so the
 * build passes until each page is cut or the owner rules on it. Remove an entry once its page fits; an entry for a
 * page that doesn't exist fails the check.
 */
export const WORD_COUNT_EXCEPTIONS = {
	'linear-algebra/dot-product': { measured: 3346 },
	'linear-algebra/vectors': { measured: 3156 },
	'probability/bayes-theorem': { measured: 3568 },
	'probability/independence': { measured: 3402 },
	'probability/naive-bayes-classifier': { measured: 2723 },
};

/** Attributes that are reader prose: the CheckYourself question, the Analogy's limit, the Mistake, the one-liner. */
const PROSE_ATTRIBUTES = new Set(['question', 'breaks', 'wrong', 'oneLiner']);
/** Elements whose whole content is left out: code, tables, answers, and the generated lists. */
const SKIPPED_ELEMENTS = new Set(['CheckYourself', 'PyRunner', 'References', 'PropertiesTable', 'NotationKey', 'Takeaways', 'ConceptMap', 'table', 'pre', 'code', 'svg', 'style', 'script']);
/** Elements a reader opens to see, or that have their own caps: also left out in `visible` mode. */
const FOLDED_ELEMENTS = ['Fold', 'Simpler', 'GoDeeper', 'PreciseStatement', 'FormalDefinition', 'ResearchFrontier'];
const SKIPPED_BY_MODE = { all: SKIPPED_ELEMENTS, visible: new Set([...SKIPPED_ELEMENTS, ...FOLDED_ELEMENTS]) };
/** Elements that render a single symbol, so they count like a formula. */
const ONE_WORD_ELEMENTS = new Set(['Var']);
/** Stands in for a formula, an inline code span or a symbol: one word each. */
const ONE_WORD = ' formula ';

/** The index just past a quoted string or template literal that starts at `start`. */
function skipString(source, start) {
	const quote = source[start];
	for (let index = start + 1; index < source.length; index += 1) {
		if (source[index] === '\\') index += 1;
		else if (quote === '`' && source.startsWith('${', index)) index = skipExpression(source, index + 1) - 1;
		else if (source[index] === quote) return index + 1;
	}
	throw new Error(`word count: unclosed ${quote} starting "${source.slice(start, start + 40)}"`);
}

/** The index just past the `}` that closes the `{` at `start`, skipping strings and nested braces. */
function skipExpression(source, start) {
	let depth = 0;
	for (let index = start; index < source.length; index += 1) {
		const character = source[index];
		if (character === '"' || character === "'" || character === '`') index = skipString(source, index) - 1;
		else if (character === '{') depth += 1;
		else if (character === '}' && --depth === 0) return index + 1;
	}
	throw new Error(`word count: unclosed { starting "${source.slice(start, start + 40)}"`);
}

/** A JSX or HTML tag at `start`: its name, kind, end and string attributes; null when `<` doesn't open a tag. */
function readTag(source, start) {
	const head = /^<(\/?)([A-Za-z][\w.:-]*)/.exec(source.slice(start, start + 100));
	if (!head) return null;
	const attributes = [];
	let index = start + head[0].length;
	while (index < source.length) {
		const rest = source.slice(index);
		const space = /^\s+/.exec(rest);
		if (space) index += space[0].length;
		else if (rest.startsWith('/>')) return { name: head[2], closing: head[1] === '/', selfClosing: true, end: index + 2, attributes };
		else if (rest.startsWith('>')) return { name: head[2], closing: head[1] === '/', selfClosing: false, end: index + 1, attributes };
		else if (rest.startsWith('{')) index = skipExpression(source, index);
		else {
			const name = /^[^\s=/>{]+/.exec(rest)?.[0];
			if (!name) throw new Error(`word count: unreadable tag at "${source.slice(start, start + 60)}"`);
			index += name.length;
			if (source[index] !== '=') continue;
			index += 1;
			if (source[index] === '{') index = skipExpression(source, index);
			else if (source[index] === '"' || source[index] === "'") {
				const end = skipString(source, index);
				attributes.push([name, source.slice(index + 1, end - 1)]);
				index = end;
			} else throw new Error(`word count: unquoted attribute ${name} at "${source.slice(start, start + 60)}"`);
		}
	}
	throw new Error(`word count: unclosed tag at "${source.slice(start, start + 60)}"`);
}

/** The index just past the tag that closes the element opened at `from`, counting nested elements of the same name. */
function skipElement(source, from, name) {
	let depth = 1;
	let index = from;
	while (index < source.length) {
		const character = source[index];
		const span = character === '$' || character === '`' ? spanEnd(source, index) : -1;
		const tag = character === '<' ? readTag(source, index) : null;
		if (character === '\\') index += 2;
		else if (span !== -1) index = span;
		else if (character === '{') index = skipExpression(source, index);
		else if (tag) {
			if (tag.name === name && tag.closing) depth -= 1;
			else if (tag.name === name && !tag.selfClosing) depth += 1;
			if (depth === 0) return tag.end;
			index = tag.end;
		} else index += 1;
	}
	throw new Error(`word count: <${name}> is never closed`);
}

/** The end of a math or inline-code span at `start` (one or two `$`, or backticks), or -1 when it isn't closed. */
function spanEnd(source, start) {
	const fence = /^(\$\$|\$|`+)/.exec(source.slice(start))[0];
	const end = source.indexOf(fence, start + fence.length);
	if (end === -1 || (fence !== '$$' && source.slice(start, end).includes('\n\n'))) return -1;
	return end + fence.length;
}

/** The page's markdown with every tag removed, `skipped` elements dropped and prose attributes on their own lines. */
function withoutMarkup(source, skipped) {
	const pieces = [];
	let index = 0;
	while (index < source.length) {
		const character = source[index];
		if (character === '\\') {
			pieces.push(source.slice(index, index + 2));
			index += 2;
		} else if (character === '$' || character === '`') {
			const end = spanEnd(source, index);
			pieces.push(end === -1 ? character : source.slice(index, end));
			index = end === -1 ? index + 1 : end;
		} else if (character === '{') {
			index = skipExpression(source, index);
		} else if (character === '<' && /^<https?:\/\//.test(source.slice(index, index + 10))) {
			index = source.indexOf('>', index) + 1;
		} else if (character === '<' && readTag(source, index)) {
			const tag = readTag(source, index);
			for (const [name, value] of tag.attributes) if (!tag.closing && PROSE_ATTRIBUTES.has(name)) pieces.push(`\n\n${value}\n\n`);
			if (!tag.closing && ONE_WORD_ELEMENTS.has(tag.name)) pieces.push(ONE_WORD);
			index = !tag.closing && !tag.selfClosing && skipped.has(tag.name) ? skipElement(source, tag.end, tag.name) : tag.end;
			pieces.push(' ');
		} else {
			pieces.push(character);
			index += 1;
		}
	}
	return pieces.join('');
}

/**
 * The number of words a reader reads in a page, counted from its MDX source: the spine and every fold in `all`
 * mode, or only the prose shown with every fold closed in `visible` mode.
 */
export function countReaderWords(source, mode = 'all') {
	const skipped = SKIPPED_BY_MODE[mode];
	if (!skipped) throw new Error(`word count: unknown mode "${mode}"; use one of ${WORD_COUNT_MODES.join(', ')}`);
	const markdown = source
		.replace(FRONTMATTER, '')
		.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[^\n]*$/gm, '')
		.replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, '')
		.replace(/^(?:import|export)\s.*$/gm, '');
	const prose = withoutMarkup(markdown, skipped)
		.replace(/^[ \t]*\|.*$/gm, '')
		.replace(/\$\$[\s\S]*?\$\$/g, ONE_WORD)
		.replace(/(?<!\\)\$(?:(?!\n\s*\n)[^$])+?(?<!\\)\$/g, ONE_WORD)
		.replace(/(`+)(?:(?!\n\s*\n)[\s\S])+?\1/g, ONE_WORD)
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/https?:\/\/\S+/g, '')
		.replace(/&(?:[a-z]+|#\d+);/gi, ' ')
		.replace(/^[ \t]*(?:#{1,6}|[-*+]|\d+[.)]|>)[ \t]+/gm, '');
	return prose.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Pins what the counter counts and leaves out, so a change to it fails loudly. */
function checkWordCounter() {
	const sentence = 'The mean balances the bar.';
	assert.equal(countReaderWords(sentence), 5);
	assert.equal(countReaderWords(`${sentence}\n\n<PropertiesTable rows={[{ name: "Mean", value: "np" }]} examples={["\\\\text{three heads}"]} />\n`), 5);
	assert.equal(countReaderWords(`---\ntitle: "Four words of title"\n---\n\nimport Fold from "../Fold.astro";\n\n${sentence}`), 5);
	assert.equal(countReaderWords('One sum:\n\n$$\n\\sum_{i=1}^{n} x_i\n$$\n\nand $x < y$ here.'), 6, 'a formula is one word');
	assert.equal(countReaderWords('| A | B |\n| --- | --- |\n| one two | three |\n\n<table><tr><td>four five</td></tr></table>\n\nKept words.'), 2, 'tables are left out');
	assert.equal(countReaderWords('<CheckYourself level="standard" question="Is it fair?">\nYes, because the answer is hidden.\n</CheckYourself>'), 3, 'the question counts, the answer does not');
	assert.equal(countReaderWords('Run it.\n\n<PyRunner title="a.py" code={`\nprint(f"{x:.3f}")  # a < b\n`} />\n\n```python\nx = 1\n```'), 2, 'code is left out');
	assert.equal(countReaderWords('<Fold kind="answer" label="the check">\n\n1. First step here.\n2. Then `np.std` and <Var name="mu" />.\n\n</Fold>'), 7, 'fold children and list items count, markers do not');
	assert.equal(countReaderWords('See [the normal page](/statistics/normal-distribution/#tails) <Cite id="he2015" />.'), 4, 'link text counts, the address does not');
	assert.equal(countReaderWords('<Mistake wrong="Equal counts mean no mode.">\n  One value repeated is the mode.\n</Mistake>\n\n<References />'), 11);
	assert.equal(countReaderWords('{/* a note for writers */}\nTwo words.'), 2);
	assert.equal(countReaderWords('<CheckYourself question="Q one?">\n$0<p<1$ and `a<b` and $x_{1}<y$.\n</CheckYourself>\n\nAfter.'), 3, 'a < inside a skipped answer is not a tag');
	assert.equal(countReaderWords('Costs 5 $ today.\n\nThree more words $x$.'), 7, 'a stray $ never swallows the next paragraph');
	checkVisibleWordCounter(sentence);
}

/** Pins `visible` mode: every fold and capped component is left out, and the spine around it still counts. */
function checkVisibleWordCounter(sentence) {
	const around = (element) => `${sentence}\n\n${element}\n\nTwo more.`;
	const folded = {
		Fold: '<Fold kind="answer" label="the check">\n\nHidden fold words here.\n\n</Fold>',
		Simpler: '<Simpler label="the same idea with dice">\n\nHidden simpler words.\n\n</Simpler>',
		GoDeeper: '<GoDeeper label="why it works" id="why">\n\nHidden proof words.\n\n</GoDeeper>',
		PreciseStatement: '<PreciseStatement>\n\nHidden exact statement $x$.\n\n</PreciseStatement>',
		FormalDefinition: '<FormalDefinition>\n\n<StepThrough title="Step" rigor="full">\nHidden step words.\n</StepThrough>\n\n</FormalDefinition>',
		ResearchFrontier: '<ResearchFrontier reviewed="2026-11-25">\n\nHidden frontier words.\n\n</ResearchFrontier>',
	};
	for (const [name, element] of Object.entries(folded)) {
		assert.equal(countReaderWords(around(element), 'visible'), 7, `visible mode leaves out ${name}`);
		assert.ok(countReaderWords(around(element)) > 7, `all mode counts ${name}`);
	}
	const nested = '<FormalDefinition>\n\n<Simpler label="inner">\nInner words.\n</Simpler>\n\nOuter words.\n\n</FormalDefinition>';
	assert.equal(countReaderWords(around(nested), 'visible'), 7, 'a fold inside a capped component goes with it');
	assert.equal(countReaderWords(around(nested)), 11, 'all mode counts both levels');
	const spine = '<StepThrough title="Worked" rigor="full">\nSpine step words.\n</StepThrough>\n\n<SideNote>\nAside here.\n</SideNote>';
	assert.equal(countReaderWords(spine, 'visible'), 5, 'spine walk-throughs and side notes stay visible');
	assert.equal(countReaderWords('<Mistake wrong="Wrong idea.">\nRight idea.\n</Mistake>', 'visible'), 4, 'prose attributes stay visible');
	assert.throws(() => countReaderWords(sentence, 'spine'), /unknown mode "spine"/);
}

/** A page's word count against its type's limits: a problem, or a warning when the page has a recorded exception. */
function wordCountProblems(pages) {
	const problems = [];
	const warnings = [];
	const counts = [];
	const ids = new Set(pages.map((page) => page.id));
	for (const id of Object.keys(WORD_COUNT_EXCEPTIONS)) if (!ids.has(id)) problems.push(`WORD_COUNT_EXCEPTIONS: no page "${id}"`);
	for (const { name, id, source, data, error } of pages) {
		const type = text(data.type);
		if (error || !type) continue;
		const limits = WORD_LIMITS[type];
		const mode = limits?.mode ?? 'all';
		let words;
		try {
			words = countReaderWords(source, mode);
		} catch (countError) {
			problems.push(`${name}: ${countError.message}`);
			continue;
		}
		counts.push({ id, type, mode, words, depthStatus: text(data.depthStatus) });
		if (!limits || text(data.depthStatus) !== 'complete') continue;
		const exception = WORD_COUNT_EXCEPTIONS[id];
		const inRange = words >= limits.min && words <= limits.max;
		const range = `${limits.min > 0 ? `${limits.min}-${limits.max}` : `at most ${limits.max}`} ${limits.mode} words`;
		if (inRange && exception) warnings.push(`${name}: ${words} reader words now fits type ${type} (${range}); remove it from WORD_COUNT_EXCEPTIONS`);
		else if (!inRange && exception) warnings.push(`${name}: ${words} reader words, outside type ${type}'s ${range} (recorded exception, measured ${exception.measured})`);
		else if (!inRange) problems.push(`${name}: ${words} reader words; a complete type ${type} page has ${range} (docs/design-system/writing-a-concept-page.md, Length)`);
	}
	return { problems, warnings, counts };
}

async function main() {
	checkCitationRules();
	checkWordCounter();
	checkPropertiesTableRules();
	const pages = await readPages();
	const pagesById = new Map(pages.map((page) => [page.id, page]));
	const seo = seoProblems(pages);
	const wordCounts = wordCountProblems(pages);
	const problems = [
		...duplicateIds(pages, 'id', 'src/content/docs (two files serve the same route)'),
		...topicProblems(pagesById),
		...duplicateIds(NOTATION, 'key', 'notation.mjs'),
		...referenceProblems(),
		...pageProblems(pages),
		...seo.problems,
		...intentProblems(pages),
		...propertiesTableProblems(pages),
		...spellingProblems(pages),
		...wordCounts.problems,
	];
	console.log('Reader words per concept page (type, mode, depthStatus):');
	for (const { id, type, mode, words, depthStatus } of [...wordCounts.counts].sort((a, b) => a.id.localeCompare(b.id))) {
		console.log(`  ${String(words).padStart(5)}  ${type}  ${mode.padEnd(7)}  ${depthStatus ?? 'no depthStatus'}  ${id}`);
	}
	for (const warning of [...seo.warnings, ...wordCounts.warnings]) console.warn(`  warning: ${warning}`);
	if (problems.length > 0) {
		console.error(`Content check failed with ${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`Content check passed: ${pages.length} pages, ${TOPICS.length} topics, ${NOTATION.length} symbols, ${REFERENCES.length} references.`);
}

// Run only as a script, so another script can import countReaderWords without running the whole check.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error('Content check crashed:', error);
		process.exit(1);
	});
}
