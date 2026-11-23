// Starlight route middleware: runs before every page renders.
// - Records the subjects for the header strip, then narrows the sidebar to the active subject.
//   Filtering here (rather than in the Sidebar component) keeps Starlight's sidebar state
//   persistence and markup working on the list the reader actually sees.
// - Keeps previous/next links inside the active subject, so a page never "continues" into another subject.
// - Adds JSON-LD structured data: WebSite + Organization on the home page, breadcrumb + article on concept pages.
// - Keeps the 404 page out of search results: no canonical URL (it would name /404/, which doesn't exist) and noindex.
// - Fails the build if a concept page is missing the frontmatter its components and checks rely on (decision 0009).
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { DOMAINS } from './design/domains.mjs';
import { filterSidebarToActiveDomain, getDomains } from './components/overrides/domains';
import { conceptPageGraph, homeGraph, serialiseJsonLd } from './seo/structuredData';

const SUBJECT_DIRECTORIES = new Set(DOMAINS.map((domain) => domain.directory));
const HOME_ROUTE_ID = '';
const NOT_FOUND_ROUTE_ID = '404';

/** The subject directory a path or route id belongs to, or null (home, introduction). */
function subjectOf(pathOrId: string): string | null {
	const firstSegment = pathOrId.split('/').filter(Boolean)[0] ?? '';
	return SUBJECT_DIRECTORIES.has(firstSegment) ? firstSegment : null;
}

type StarlightRoute = App.Locals['starlightRoute'];

const REQUIRED_CONCEPT_FIELDS = [
	'topic',
	'type',
	'objectives',
	'takeaways',
	'references',
	'author',
	'reviewedAt',
	'aiAssisted',
	'primaryQuery',
	'searchIntent',
	'depthStatus',
] as const;

/** Concept pages need every field their components and checks read; the topic id must match the page path. */
function assertConceptFrontmatter(route: StarlightRoute) {
	const data = route.entry.data as Record<string, unknown>;
	const missing = REQUIRED_CONCEPT_FIELDS.filter((field) => data[field] === undefined);
	if (missing.length > 0) {
		throw new Error(`${route.id}: concept page frontmatter is missing ${missing.join(', ')} (see docs/design-system/writing-a-concept-page.md).`);
	}
	if (data.topic !== route.id) {
		throw new Error(`${route.id}: frontmatter topic is "${String(data.topic)}" but must match the page path "${route.id}".`);
	}
}

/** JSON-LD for the page, or null for pages that get none (the introduction, the 404 page). */
function structuredDataFor(route: StarlightRoute, subject: string | null) {
	if (route.id === HOME_ROUTE_ID) return homeGraph();
	if (!subject) return null;
	return conceptPageGraph({
		title: route.entry.data.title,
		description: route.entry.data.description ?? '',
		author: route.entry.data.author,
		dateModified: route.entry.data.reviewedAt,
		path: `/${route.id}/`,
		subjectLabel: DOMAINS.find((domain) => domain.directory === subject)?.label ?? subject,
	});
}

/** Starlight gives every page a canonical link and og:url; for the 404 page those name a URL that doesn't exist. */
function markNotFoundPage(route: StarlightRoute) {
	route.head = route.head.filter(
		(entry) => !(entry.tag === 'link' && entry.attrs?.rel === 'canonical') && !(entry.tag === 'meta' && entry.attrs?.property === 'og:url'),
	);
	route.head.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } });
}

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	context.locals.subjects = getDomains(route.sidebar);
	route.sidebar = filterSidebarToActiveDomain(route.sidebar);

	if (route.id === NOT_FOUND_ROUTE_ID) markNotFoundPage(route);

	const subject = subjectOf(route.id);
	if (subject) assertConceptFrontmatter(route);
	const structuredData = structuredDataFor(route, subject);
	if (structuredData) {
		route.head.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: serialiseJsonLd(structuredData) });
	}

	if (subject) {
		const { prev, next } = route.pagination;
		route.pagination = {
			prev: prev && subjectOf(prev.href) === subject ? prev : undefined,
			next: next && subjectOf(next.href) === subject ? next : undefined,
		};
	}
});
