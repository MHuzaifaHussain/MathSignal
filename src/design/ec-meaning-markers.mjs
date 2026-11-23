// Expressive Code plugin: wraps identifiers named mu / sigma (and variants such as mu_hat,
// sigma_hat, TRUE_MU) in .ms-mu / .ms-sigma spans, so code shares the meaning colors used in
// prose, formulas and plots. Matches inside strings and comments are left alone.
// Styles: src/styles/components.css (.ms-code-marker). Rules: docs/design-system/math-plots-code.md
import { ExpressiveCodeAnnotation, InlineStyleAnnotation } from '@astrojs/starlight/expressive-code';
import { h } from '@astrojs/starlight/expressive-code/hast';
import { nonCodeTokenColors } from './code-themes.mjs';

/**
 * Whole identifiers such as mu, sigma, mu_hat, sigma2, TRUE_MU, log_sigma, sigma_sq.
 * Prefixes and suffixes must be joined by an underscore (or be digits), so words that merely
 * start with the letters, like mutable or multiply, never match.
 */
const IDENTIFIER_PATTERN = /\b(?:[A-Za-z0-9]+_)*(mu|sigma)(?:_[A-Za-z0-9]+|\d+)*\b/gi;
const MEANINGS = /** @type {const} */ (['mu', 'sigma']);

class MeaningMarkerAnnotation extends ExpressiveCodeAnnotation {
	/** @param {'mu' | 'sigma'} meaning @param {{ columnStart: number, columnEnd: number }} inlineRange */
	constructor(meaning, inlineRange) {
		// Render after syntax highlighting so the marker wraps the highlighted token.
		super({ inlineRange, renderPhase: 'later' });
		this.name = 'ms-meaning-marker';
		this.meaning = meaning;
	}

	/** @param {{ nodesToTransform: import('hast').Parents[] }} options */
	render({ nodesToTransform }) {
		return nodesToTransform.map((node) => h(`span.ms-code-marker.ms-${this.meaning}`, [node]));
	}
}

/** True if a syntax-highlighting annotation colors this range as a string or comment. */
function isInsideStringOrComment(line, columnStart, columnEnd) {
	return line.getAnnotations().some((annotation) => {
		if (!(annotation instanceof InlineStyleAnnotation) || !annotation.color || !annotation.inlineRange) return false;
		const { columnStart: start, columnEnd: end } = annotation.inlineRange;
		const overlaps = start < columnEnd && end > columnStart;
		return overlaps && nonCodeTokenColors.has(annotation.color.toLowerCase());
	});
}

/** Which meaning an identifier carries: the word that matched, e.g. TRUE_MU -> mu. */
function meaningOf(match) {
	const word = match[1].toLowerCase();
	return MEANINGS.find((meaning) => meaning === word);
}

export function pluginMeaningMarkers() {
	return {
		name: 'MathSignal meaning markers',
		hooks: {
			postprocessAnnotations: ({ codeBlock }) => {
				for (const line of codeBlock.getLines()) {
					for (const match of line.text.matchAll(IDENTIFIER_PATTERN)) {
						const meaning = meaningOf(match);
						const columnStart = match.index;
						const columnEnd = columnStart + match[0].length;
						if (!meaning || isInsideStringOrComment(line, columnStart, columnEnd)) continue;
						line.addAnnotation(new MeaningMarkerAnnotation(meaning, { columnStart, columnEnd }));
					}
				}
			},
		},
	};
}
