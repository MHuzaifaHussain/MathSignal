// Renders TeX to HTML at build time for Astro components (NotationKey and friends), with the same macros
// and trust rules as page formulas. Imports KaTeX's ESM file directly: the bare `katex` import is aliased
// to a stub inside Vite to keep KaTeX out of islands (decision 0007).
import katex from 'katex/dist/katex.mjs';
import { katexOptions } from './katex.mjs';

/** @param {string} tex @param {{ displayMode?: boolean }} [options] */
export function renderTex(tex, { displayMode = false } = {}) {
	// throwOnError: a broken symbol fails the build instead of shipping red error text.
	return katex.renderToString(tex, { ...katexOptions, displayMode, throwOnError: true });
}
