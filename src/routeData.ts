// Starlight route middleware: runs before every page renders.
// - Records the subjects for the header strip, then narrows the sidebar to the active subject.
//   Filtering here (rather than in the Sidebar component) keeps Starlight's sidebar state
//   persistence and markup working on the list the reader actually sees.
// - Keeps previous/next links inside the active subject, so a page never "continues" into another subject.
// - Adds JSON-LD structured data: WebSite + Organization on the home page, breadcrumb + article on concept pages.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { DOMAINS } from './design/domains.mjs';
import { filterSidebarToActiveDomain, getDomains } from './components/overrides/domains';
import { conceptPageGraph, homeGraph, serialiseJsonLd } from './seo/structuredData';

const SUBJECT_DIRECTORIES = new Set(DOMAINS.map((domain) => domain.directory));
const HOME_ROUTE_ID = '';

/** The subject directory a path or route id belongs to, or null (home, introduction). */
function subjectOf(pathOrId: string): string | null {
	const firstSegment = pathOrId.split('/').filter(Boolean)[0] ?? '';
	return SUBJECT_DIRECTORIES.has(firstSegment) ? firstSegment : null;
}

type StarlightRoute = App.Locals['starlightRoute'];

/** JSON-LD for the page, or null for pages that get none (the introduction, the 404 page). */
function structuredDataFor(route: StarlightRoute, subject: string | null) {
	if (route.id === HOME_ROUTE_ID) return homeGraph();
	if (!subject) return null;
	return conceptPageGraph({
		title: route.entry.data.title,
		description: route.entry.data.description ?? '',
		path: `/${route.id}/`,
		subjectLabel: DOMAINS.find((domain) => domain.directory === subject)?.label ?? subject,
	});
}

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	context.locals.subjects = getDomains(route.sidebar);
	route.sidebar = filterSidebarToActiveDomain(route.sidebar);

	const subject = subjectOf(route.id);
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
