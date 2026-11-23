// Checks every internal link in the built site (dist/), after `astro build`:
//   - every href, src and og/twitter image on our own domain points at a file that exists
//   - every #anchor exists on the page it points to (folds, references, headings)
//   - page links end with a slash, matching `trailingSlash: 'always'` (docs/seo/README.md)
// External links are not fetched: that would make the build depend on other sites being up.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from '../src/seo/site.mjs';

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url));
const LINK_ATTRIBUTE = /\s(?:href|src)="([^"]*)"/g;
const SOCIAL_IMAGE = /<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]*)"/g;
const ID_ATTRIBUTE = /\sid="([^"]*)"/g;
const NON_HTTP_SCHEME = /^(?:mailto|tel|data|javascript|blob):/i;

async function htmlFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => (entry.isDirectory() ? htmlFiles(join(directory, entry.name)) : entry.name.endsWith('.html') ? [join(directory, entry.name)] : [])),
	);
	return files.flat();
}

/** The URL path a built HTML file is served at: dist/about/index.html -> /about/ */
function servedPath(file) {
	const path = `/${relative(DIST_DIR, file).replace(/\\/g, '/')}`;
	return path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path;
}

function decodeEntities(value) {
	return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Our own links as { path, hash }, resolved against the page they appear on; null for external links. */
function internalTarget(rawLink, pagePath) {
	const link = decodeEntities(rawLink).trim();
	if (link === '' || NON_HTTP_SCHEME.test(link)) return null;
	if (/^https?:\/\//i.test(link) && !link.startsWith(`${SITE_URL}/`) && link !== SITE_URL) return null;
	if (link.startsWith('//')) return null;
	const url = new URL(link, `${SITE_URL}${pagePath}`);
	return { path: decodeURIComponent(url.pathname), hash: decodeURIComponent(url.hash.slice(1)) };
}

/** The dist file that serves a path, or null if nothing does. */
function fileFor(path) {
	const candidate = join(DIST_DIR, path);
	if (path.endsWith('/')) return existsSync(join(candidate, 'index.html')) ? join(candidate, 'index.html') : null;
	if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	return null;
}

async function main() {
	if (!existsSync(DIST_DIR)) {
		console.error('Link check: dist/ does not exist. Run `npm run build` first.');
		process.exit(1);
	}
	const pages = await Promise.all(
		(await htmlFiles(DIST_DIR)).map(async (file) => ({ file, path: servedPath(file), html: await readFile(file, 'utf8') })),
	);
	const idsByFile = new Map(pages.map((page) => [page.file, new Set([...page.html.matchAll(ID_ATTRIBUTE)].map((match) => match[1]))]));
	const problems = new Set();
	let checked = 0;

	for (const page of pages) {
		const links = [...page.html.matchAll(LINK_ATTRIBUTE), ...page.html.matchAll(SOCIAL_IMAGE)].map((match) => match[1]);
		for (const link of links) {
			const target = internalTarget(link, page.path);
			if (!target) continue;
			checked += 1;
			const where = `${page.path}: "${link}"`;
			const looksLikePage = extname(target.path) === '';
			if (looksLikePage && !target.path.endsWith('/')) {
				problems.add(`${where} needs a trailing slash`);
				continue;
			}
			const file = fileFor(target.path);
			if (!file) {
				problems.add(`${where} points at a page or file that doesn't exist`);
				continue;
			}
			if (target.hash && file.endsWith('.html') && !idsByFile.get(file)?.has(target.hash)) {
				problems.add(`${where}: no element with id "${target.hash}" on ${target.path}`);
			}
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
