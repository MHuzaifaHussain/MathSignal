// Verifies the content registries and the ids pages use (decision 0009), before every build:
//   - topics: unique ids, every prerequisite / leadsTo id exists, no prerequisite cycles,
//     prerequisites and leadsTo agree in both directions, and a topic's status matches its page:
//     published = a page that isn't a draft, planned = no page yet or a draft
//   - notation and references: unique ids; every reference has an https URL and a `checked` date
//   - pages: every topic, reference, <Cite id> and <NotationKey symbols> id they use exists
//   - SEO: descriptions 120-160 characters; titles, descriptions and primary queries unique (docs/seo/README.md);
//     searchIntent matches the page type
// Required frontmatter on concept pages is enforced during the build by src/routeData.ts.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS } from '../src/data/topics.mjs';
import { NOTATION } from '../src/data/notation.mjs';
import { REFERENCES } from '../src/data/references.mjs';
import { SITE_NAME } from '../src/seo/site.mjs';

const DOCS_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
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

function topicProblems() {
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
		problems.push(...releaseProblems(topic));
	}
	problems.push(...prerequisiteCycles(byId));
	return problems;
}

/**
 * A topic's status and its page's `draft` flag must agree, because other pages link to a topic only when it is
 * published: published means the page exists and is not a draft; planned means there is no page yet, or a draft.
 * Pages are merged as drafts and released by flipping both together.
 */
function releaseProblems(topic) {
	const file = join(DOCS_DIR, `${topic.id}.mdx`);
	const exists = existsSync(file);
	const isDraft = exists && /^draft:\s*true\s*$/m.test(frontmatterOf(readFileSync(file, 'utf8')));
	if (topic.status === 'published' && !exists) return [`topics.mjs: "${topic.id}" is marked published but src/content/docs/${topic.id}.mdx doesn't exist`];
	if (topic.status === 'published' && isDraft) return [`topics.mjs: "${topic.id}" is marked published but its page has \`draft: true\`; release both together`];
	if (topic.status === 'planned' && exists && !isDraft) return [`topics.mjs: "${topic.id}" is still planned but its page is not a draft; set status 'published' or add \`draft: true\``];
	return [];
}

/** @param {string} source */
function frontmatterOf(source) {
	return source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
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

async function mdxFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => (entry.isDirectory() ? mdxFiles(join(directory, entry.name)) : entry.name.endsWith('.mdx') ? [join(directory, entry.name)] : [])),
	);
	return files.flat();
}

/** Ids used in a page's frontmatter and components, found with simple patterns over the MDX source. */
function idsUsedIn(source) {
	const frontmatter = frontmatterOf(source);
	const topic = frontmatter.match(/^topic:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];
	const referenceBlock = frontmatter.match(/^references:\s*\n((?:\s+-\s.*\n?)+)/m)?.[1] ?? '';
	const frontmatterReferences = [...referenceBlock.matchAll(/-\s*["']?([^"'\n]+?)["']?\s*$/gm)].map((match) => match[1]);
	const cited = [...source.matchAll(/<Cite\s+id=["']([^"']+)["']/g)].map((match) => match[1]);
	const symbols = [...source.matchAll(/<NotationKey\s+symbols=\{\[([^\]]*)\]\}/g)].flatMap((match) => [...match[1].matchAll(/["']([^"']+)["']/g)].map((symbol) => symbol[1]));
	return { topic, frontmatterReferences, cited, symbols };
}

/** Every MDX page once: its path under src/content/docs, its source with LF line endings, and its frontmatter. */
async function readPages() {
	return Promise.all(
		(await mdxFiles(DOCS_DIR)).map(async (file) => {
			const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
			return { name: relative(DOCS_DIR, file).replace(/\\/g, '/'), source, frontmatter: frontmatterOf(source) };
		}),
	);
}

function pageProblems(pages) {
	const topicIds = new Set(TOPICS.map((topic) => topic.id));
	const referenceIds = new Set(REFERENCES.map((reference) => reference.id));
	const notationKeys = new Set(NOTATION.map((entry) => entry.key));
	const problems = [];
	for (const { name, source } of pages) {
		const { topic, frontmatterReferences, cited, symbols } = idsUsedIn(source);
		if (topic && !topicIds.has(topic)) problems.push(`${name}: unknown topic "${topic}"`);
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

/** A single-line frontmatter value, with surrounding quotes removed. */
function frontmatterValue(frontmatter, field) {
	const raw = frontmatter.match(new RegExp(`^${field}:[ \t]*(.+?)[ \t]*$`, 'm'))?.[1];
	return raw?.replace(/^(["'])(.*)\1$/, '$2');
}

/**
 * The SEO rules in docs/seo/README.md that a script can check: descriptions are 120-160 characters, and no two
 * pages share a title, a description or a primary query. The ~60-character <title> limit is a guide, so it warns.
 */
function seoProblems(pages) {
	const problems = [];
	const warnings = [];
	const seen = { title: new Map(), description: new Map(), primaryQuery: new Map() };
	for (const { name, frontmatter } of pages) {
		const values = Object.fromEntries(Object.keys(seen).map((field) => [field, frontmatterValue(frontmatter, field)]));
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
	return pages.flatMap(({ name, frontmatter }) => {
		const type = frontmatterValue(frontmatter, 'type');
		const intent = frontmatterValue(frontmatter, 'searchIntent');
		if (!type || !intent || INTENT_FOR_TYPE[type] === intent) return [];
		return [`${name}: a type ${type} page has searchIntent "${INTENT_FOR_TYPE[type] ?? '(unknown type)'}", not "${intent}"`];
	});
}

async function main() {
	const pages = await readPages();
	const seo = seoProblems(pages);
	const problems = [
		...topicProblems(),
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
