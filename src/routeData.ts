// Starlight route middleware: runs before every page renders.
// Records the subjects for the header strip, then narrows the sidebar to the active subject.
// Filtering here (rather than in the Sidebar component) keeps Starlight's sidebar state
// persistence and markup working on the list the reader actually sees.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { filterSidebarToActiveDomain, getDomains } from './components/overrides/domains';

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	context.locals.subjects = getDomains(route.sidebar);
	route.sidebar = filterSidebarToActiveDomain(route.sidebar);
});
