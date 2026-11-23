// Verifies the content registries and the ids pages use (decision 0009), before every build:
//   - topics: unique ids, every prerequisite / leadsTo id exists, no prerequisite cycles,
//     prerequisites and leadsTo agree in both directions, and a topic's status matches its page:
//     published = a page that isn't a draft, planned = no page yet or a draft
//   - notation and references: unique ids; every reference has an https URL and a `checked` date
//   - pages: every topic, reference, <Cite id> and <NotationKey symbols> id they use exists
//   - SEO: descriptions 120-160 characters; titles, descriptions and primary queries unique (docs/seo/README.md);
//     searchIntent matches the page type
// Frontmatter is parsed the way Astro parses it (the `yaml` package, core schema), so `draft: True`, comments,
// quoting and multi-line values mean the same here as in the build.
// Required frontmatter on concept pages is enforced during the build by src/routeData.ts.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { TOPICS } from '../src/data/topics.mjs';
import { NOTATION } from '../src/data/notation.mjs';
import { REFERENCES } from '../src/data/references.mjs';
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
	}
	return problems;
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
			const source = await readFile(file, 'utf8');
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

function intentProblems(pages) {
	return pages.flatMap(({ name, data, error }) => {
		const type = text(data.type);
		const intent = text(data.searchIntent);
		if (error || !type || !intent || INTENT_FOR_TYPE[type] === intent) return [];
		return [`${name}: a type ${type} page has searchIntent "${INTENT_FOR_TYPE[type] ?? '(unknown type)'}", not "${intent}"`];
	});
}

async function main() {
	const pages = await readPages();
	const pagesById = new Map(pages.map((page) => [page.id, page]));
	const seo = seoProblems(pages);
	const problems = [
		...duplicateIds(pages, 'id', 'src/content/docs (two files serve the same route)'),
		...topicProblems(pagesById),
		...duplicateIds(NOTATION, 'key', 'notation.mjs'),
		...referenceProblems(),
		...pageProblems(pages),
		...seo.problems,
		...intentProblems(pages),
	];
	for (const warning of seo.warnings) console.warn(`  warning: ${warning}`);
	if (problems.length > 0) {
		console.error(`Content check failed with ${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`Content check passed: ${pages.length} pages, ${TOPICS.length} topics, ${NOTATION.length} symbols, ${REFERENCES.length} references.`);
}

main().catch((error) => {
	console.error('Content check crashed:', error);
	process.exit(1);
});
