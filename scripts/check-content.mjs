// Verifies the content registries and the ids pages use (decision 0009), before every build:
//   - topics: unique ids, every prerequisite / leadsTo id exists, no prerequisite cycles,
//     prerequisites and leadsTo agree in both directions, and a topic's status matches its page:
//     published = a page that isn't a draft, planned = no page yet or a draft
//   - notation and references: unique ids; every reference has an https URL and a `checked` date
//   - pages: every topic, reference, <Cite id> and <NotationKey symbols> id they use exists
// Required frontmatter on concept pages is enforced during the build by src/routeData.ts.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS } from '../src/data/topics.mjs';
import { NOTATION } from '../src/data/notation.mjs';
import { REFERENCES } from '../src/data/references.mjs';

const DOCS_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

async function pageProblems() {
	const topicIds = new Set(TOPICS.map((topic) => topic.id));
	const referenceIds = new Set(REFERENCES.map((reference) => reference.id));
	const notationKeys = new Set(NOTATION.map((entry) => entry.key));
	const problems = [];
	for (const file of await mdxFiles(DOCS_DIR)) {
		const name = relative(DOCS_DIR, file).replace(/\\/g, '/');
		const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
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

async function main() {
	const problems = [
		...topicProblems(),
		...duplicateIds(NOTATION, 'key', 'notation.mjs'),
		...referenceProblems(),
		...(await pageProblems()),
	];
	if (problems.length > 0) {
		console.error(`Content check failed with ${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`Content check passed: ${TOPICS.length} topics, ${NOTATION.length} symbols, ${REFERENCES.length} references.`);
}

main().catch((error) => {
	console.error('Content check crashed:', error);
	process.exit(1);
});
