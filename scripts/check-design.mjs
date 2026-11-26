// Verifies the design system rules before every build:
//   1. every contrast pair in src/design/palette.mjs meets its minimum, in both themes
//   2. code colors stay perceptually far from the meaning colors (mu, sigma, attention),
//      for normal vision and the three common color-vision deficiencies
//   3. every file generated from the palette (tokens.css, favicon, logos) is up to date
//   4. Expressive Code draws line numbers in the palette colors checked above, not a faded copy of them
// Fails loudly with every violation listed, so nothing ships silently off-spec.
import { contrastRules, meaningSeparation, palette } from '../src/design/palette.mjs';
import { COLOR_VISION_TYPES, contrastRatio, perceptualDistance } from './lib/color.mjs';
import { staleGeneratedFiles } from './build-tokens.mjs';
import ecConfig from '../ec.config.mjs';

const MINIMUM_CONTRAST = { text: 4.5, large: 3, graphic: 3, code: 5.5 };

/** @param {string} themeName @param {Record<string, string>} theme */
function contrastViolations(themeName, theme) {
	return contrastRules.flatMap(([foreground, background, kind]) => {
		if (!(foreground in theme) || !(background in theme)) {
			return [`${themeName}: contrast rule references unknown token "${foreground}" or "${background}"`];
		}
		const ratio = contrastRatio(theme[foreground], theme[background]);
		const minimum = MINIMUM_CONTRAST[kind];
		return ratio >= minimum ? [] : [`${themeName}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1, needs ${minimum}:1 (${kind})`];
	});
}

/** @param {string} themeName @param {Record<string, string>} theme */
function separationViolations(themeName, theme) {
	const { tokens, anchors, minNormal, minColorBlind } = meaningSeparation;
	return tokens.flatMap((token) =>
		anchors.flatMap((anchor) => {
			const normal = perceptualDistance(theme[token], theme[anchor]);
			const problems = normal >= minNormal ? [] : [`${themeName}: ${token} is ${normal.toFixed(1)} from ${anchor} (normal vision), needs ${minNormal}`];
			for (const visionType of COLOR_VISION_TYPES) {
				const distance = perceptualDistance(theme[token], theme[anchor], visionType);
				if (distance < minColorBlind) {
					problems.push(`${themeName}: ${token} is ${distance.toFixed(1)} from ${anchor} (${visionType}), needs ${minColorBlind}`);
				}
			}
			return problems;
		}),
	);
}

/** Gutter styles Expressive Code would otherwise fade with alpha, and the palette token each must resolve to. */
const GUTTER_STYLE_TOKENS = { gutterForeground: 'codeLineNumber', gutterHighlightForeground: 'codeInk' };

/** @param {string} themeName @param {Record<string, string>} theme */
function gutterColorViolations(themeName, theme) {
	return Object.entries(GUTTER_STYLE_TOKENS).flatMap(([style, token]) => {
		const resolve = ecConfig.styleOverrides?.[style];
		if (typeof resolve !== 'function') return [`ec.config.mjs: styleOverrides.${style} must be set, or Expressive Code fades line numbers under 4.5:1`];
		const color = resolve({ theme: { type: themeName } });
		return color === theme[token] ? [] : [`ec.config.mjs: ${style} is ${color} in ${themeName}, must be the palette's ${token} (${theme[token]})`];
	});
}

async function generatedFileViolations() {
	const stale = await staleGeneratedFiles();
	return stale.map((path) => `${path} is out of date: run \`npm run tokens\``);
}

async function main() {
	const violations = [
		...Object.entries(palette).flatMap(([name, theme]) => [...contrastViolations(name, theme), ...separationViolations(name, theme), ...gutterColorViolations(name, theme)]),
		...(await generatedFileViolations()),
	];
	if (violations.length > 0) {
		console.error(`Design check failed with ${violations.length} problem(s):`);
		for (const violation of violations) console.error(`  - ${violation}`);
		process.exit(1);
	}
	console.log(`Design check passed: ${contrastRules.length} contrast rules and meaning-color separation in both themes.`);
}

main().catch((error) => {
	console.error('Design check crashed:', error);
	process.exit(1);
});
