declare namespace App {
	interface Locals {
		/** Subjects for the header strip, set by src/routeData.ts before the sidebar is filtered. */
		subjects?: import('./components/overrides/domains').Domain[];
	}
}
