// Starlight route middleware: runs before every page renders.
// - Records the subjects for the header strip, then narrows the sidebar to the active subject.
//   Filtering here (rather than in the Sidebar component) keeps Starlight's sidebar state
//   persistence and markup working on the list the reader actually sees.
// - Keeps previous/next links inside the active subject, so a page never "continues" into another subject.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { DOMAINS } from './design/domains.mjs';
import { filterSidebarToActiveDomain, getDomains } from './components/overrides/domains';

const SUBJECT_DIRECTORIES = new Set(DOMAINS.map((domain) => domain.directory));

/** The subject directory a path or route id belongs to, or null (home, introduction). */
function subjectOf(pathOrId: string): string | null {
	const firstSegment = pathOrId.split('/').filter(Boolean)[0] ?? '';
	return SUBJECT_DIRECTORIES.has(firstSegment) ? firstSegment : null;
}

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	context.locals.subjects = getDomains(route.sidebar);
	route.sidebar = filterSidebarToActiveDomain(route.sidebar);

	const subject = subjectOf(route.id);
	if (subject) {
		const { prev, next } = route.pagination;
		route.pagination = {
			prev: prev && subjectOf(prev.href) === subject ? prev : undefined,
			next: next && subjectOf(next.href) === subject ? next : undefined,
		};
	}
});
