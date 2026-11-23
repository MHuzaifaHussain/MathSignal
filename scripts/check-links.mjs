// Checks every internal link in the built site (dist/), after `astro build`:
//   - every href, src and og/twitter image on our own domain points at a file that exists, with exactly that case
//     (Cloudflare serves URLs case-sensitively even though Windows finds files in any case)
//   - every #anchor exists on the page it points to (folds, references, headings)
//   - page links end with a slash, matching `trailingSlash: 'always'` (docs/seo/README.md)
// External links are not fetched: that would make the build depend on other sites being up.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from '../src/seo/site.mjs';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
const SITE_ORIGIN = new URL(SITE_URL).origin;
const LINK_ATTRIBUTE = /\s(?:href|src)="([^"]*)"/g;
const SOCIAL_IMAGE = /<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]*)"/g;
const ID_ATTRIBUTE = /\sid="([^"]*)"/g;
const NON_HTTP_SCHEME = /^(?:mailto|tel|data|javascript|blob):/i;

async function allFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(entries.map((entry) => (entry.isDirectory() ? allFiles(join(directory, entry.name)) : [join(directory, entry.name)])));
	return files.flat();
}

/** The site path of a built file, exact case: dist/about/index.html -> /about/index.html */
function sitePathOf(file) {
	return `/${relative(DIST_DIR, file).replace(/\\/g, '/')}`;
}

/** The URL a built HTML file is served at: /about/index.html -> /about/ */
function servedPath(sitePath) {
	return sitePath.endsWith('/index.html') ? sitePath.slice(0, -'index.html'.length) : sitePath;
}

function decodeEntities(value) {
	return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Our own links as { path, hash }, resolved against the page they appear on; null for other sites;
 * { invalid: true } for a malformed percent-encoding. The URL parser lowercases scheme and host, so
 * HTTPS://MathSignal.dev?x=1 counts as ours too.
 */
function internalTarget(rawLink, pagePath) {
	const link = decodeEntities(rawLink).trim();
	if (link === '' || NON_HTTP_SCHEME.test(link)) return null;
	const url = new URL(link, `${SITE_URL}${pagePath}`);
	if (url.origin !== SITE_ORIGIN) return null;
	try {
		return { path: decodeURIComponent(url.pathname), hash: decodeURIComponent(url.hash.slice(1)) };
	} catch {
		return { invalid: true };
	}
}

/** The built file that serves a path, compared exactly (case included), or null. */
function fileFor(path, builtPaths) {
	const sitePath = path.endsWith('/') ? `${path}index.html` : path;
	return builtPaths.has(sitePath) ? sitePath : null;
}

/** The problem with one link, or null if it resolves. */
function linkProblem(target, builtPaths, idsBySitePath) {
	if (target.invalid) return 'has an invalid percent-encoding';
	if (extname(target.path) === '' && !target.path.endsWith('/')) return 'needs a trailing slash';
	const file = fileFor(target.path, builtPaths);
	if (!file) return "points at a page or file that doesn't exist (check the letter case)";
	if (target.hash && file.endsWith('.html') && !idsBySitePath.get(file)?.has(target.hash)) return `has no element with id "${target.hash}" on ${target.path}`;
	return null;
}

async function main() {
	if (!existsSync(DIST_DIR)) {
		console.error('Link check: dist/ does not exist. Run `npm run build` first.');
		process.exit(1);
	}
	const files = await allFiles(DIST_DIR);
	const builtPaths = new Set(files.map(sitePathOf));
	const pages = await Promise.all(
		files.filter((file) => file.endsWith('.html')).map(async (file) => ({ sitePath: sitePathOf(file), html: await readFile(file, 'utf8') })),
	);
	const idsBySitePath = new Map(pages.map((page) => [page.sitePath, new Set([...page.html.matchAll(ID_ATTRIBUTE)].map((match) => match[1]))]));
	const problems = new Set();
	let checked = 0;

	for (const page of pages) {
		const pagePath = servedPath(page.sitePath);
		const links = [...page.html.matchAll(LINK_ATTRIBUTE), ...page.html.matchAll(SOCIAL_IMAGE)].map((match) => match[1]);
		for (const link of links) {
			const target = internalTarget(link, pagePath);
			if (!target) continue;
			checked += 1;
			const problem = linkProblem(target, builtPaths, idsBySitePath);
			if (problem) problems.add(`${pagePath}: "${link}" ${problem}`);
		}
	}

	if (problems.size > 0) {
		console.error(`Link check failed with ${problems.size} broken link(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	console.log(`Link check passed: ${checked} internal links across ${pages.length} pages.`);
}

main().catch((error) => {
	console.error('Link check crashed:', error);
	process.exit(1);
});
