// The subjects MathSignal covers, in display order. Single source for the sidebar groups
// (astro.config.mjs) and the header subject strip (src/components/overrides/domains.ts).
// Labels are sentence case, per docs/design-system/foundations.md.

/** @type {ReadonlyArray<{ readonly label: string, readonly directory: string }>} */
export const DOMAINS = Object.freeze([
	Object.freeze({ label: 'Statistics', directory: 'statistics' }),
	Object.freeze({ label: 'Probability', directory: 'probability' }),
	Object.freeze({ label: 'Linear algebra', directory: 'linear-algebra' }),
	Object.freeze({ label: 'Machine learning', directory: 'ml' }),
]);
