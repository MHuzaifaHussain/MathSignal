// Verifies the design system rules before every build:
//   1. every contrast pair in src/design/palette.mjs meets its minimum, in both themes
//   2. code colours stay perceptually far from the meaning colours (mu, sigma, attention),
//      for normal vision and the three common colour-vision deficiencies
//   3. src/styles/tokens.css matches the palette
// Fails loudly with every violation listed, so nothing ships silently off-spec.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contrastRules, meaningSeparation, palette } from '../src/design/palette.mjs';
import { COLOUR_VISION_TYPES, contrastRatio, perceptualDistance } from './lib/color.mjs';
import { renderTokensCss } from './build-tokens.mjs';

const MINIMUM_CONTRAST = { text: 4.5, large: 3, graphic: 3, code: 5.5 };
const TOKENS_PATH = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url));

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
	const { tokens, anchors, minNormal, minColourBlind } = meaningSeparation;
	return tokens.flatMap((token) =>
		anchors.flatMap((anchor) => {
			const normal = perceptualDistance(theme[token], theme[anchor]);
			const problems = normal >= minNormal ? [] : [`${themeName}: ${token} is ${normal.toFixed(1)} from ${anchor} (normal vision), needs ${minNormal}`];
			for (const visionType of COLOUR_VISION_TYPES) {
				const distance = perceptualDistance(theme[token], theme[anchor], visionType);
				if (distance < minColourBlind) {
					problems.push(`${themeName}: ${token} is ${distance.toFixed(1)} from ${anchor} (${visionType}), needs ${minColourBlind}`);
				}
			}
			return problems;
		}),
	);
}

async function tokensFileViolations() {
	const current = await readFile(TOKENS_PATH, 'utf8').catch(() => '');
	return current.replace(/\r\n/g, '\n') === renderTokensCss() ? [] : ['src/styles/tokens.css is out of date: run `npm run tokens`'];
}

async function main() {
	const violations = [
		...Object.entries(palette).flatMap(([name, theme]) => [...contrastViolations(name, theme), ...separationViolations(name, theme)]),
		...(await tokensFileViolations()),
	];
	if (violations.length > 0) {
		console.error(`Design check failed with ${violations.length} problem(s):`);
		for (const violation of violations) console.error(`  - ${violation}`);
		process.exit(1);
	}
	console.log(`Design check passed: ${contrastRules.length} contrast rules and meaning-colour separation in both themes.`);
}

main().catch((error) => {
	console.error('Design check crashed:', error);
	process.exit(1);
});
