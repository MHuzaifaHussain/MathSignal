// Single source of truth for every colour in MathSignal's "Chalk Margin" design system.
//
// Consumers:
//   - scripts/build-tokens.mjs   generates src/styles/tokens.css (CSS custom properties)
//   - src/design/code-themes.mjs builds the Expressive Code light and dark themes
//   - scripts/check-design.mjs   verifies contrast and colour-vision rules before every build
//
// Change a colour here, run `npm run tokens`, then `npm run check:design`.
// Rules and rationale: docs/design-system/foundations.md and docs/design-system/accessibility.md

/** @typedef {'light' | 'dark'} ThemeName */

export const palette = {
	light: {
		// Paper: where reading happens
		page: '#ffffff',
		ink: '#1e2725',
		inkMuted: '#56625e',
		rule: '#d5dbd9',
		surfaceSunk: '#f4f6f5',
		accent: '#2f5048',
		accentLow: '#dfe9e5',

		// Header ledge: follows the theme (light header in light mode)
		ledge: '#ffffff',
		ledgeInk: '#1e2725',
		ledgeRule: '#d5dbd9',

		// Board: where every interactive plot lives
		board: '#e4ebe6',
		boardEdge: '#748a80',
		boardTray: '#d8e1db',
		boardInk: '#26332f',
		boardInkMuted: '#4d5c57',
		boardAxis: '#748a80',
		boardGrid: '#c4d0ca',

		// Meaning colours: the only saturated colours on a page
		mu: '#b0306a',
		sigma: '#1f5fa8',
		attention: '#8a5a00',
		attentionFill: '#f2d45c',
		highlight: '#fbe7a1',

		// Code blocks (tuned full syntax)
		codeBg: '#f6f8f7',
		codeInk: '#1e2725',
		codeKeyword: '#461f62',
		codeString: '#0d4a22',
		codeNumber: '#6c1f03',
		codeComment: '#464236',
		codeLineNumber: '#5f6d69',
		codeBorder: '#d5dbd9',
	},
	dark: {
		page: '#171b1a',
		ink: '#ece8df',
		inkMuted: '#a9b0ad',
		rule: '#323a38',
		surfaceSunk: '#1f2423',
		accent: '#9fc2b8',
		accentLow: '#25332f',

		ledge: '#22302e',
		ledgeInk: '#ece8df',
		ledgeRule: '#3e4f4b',

		board: '#22302e',
		boardEdge: '#6a8079',
		boardTray: '#1a2523',
		boardInk: '#ece8df',
		boardInkMuted: '#a9b5b1',
		boardAxis: '#6a8079',
		boardGrid: '#2f403d',

		mu: '#f59ab4',
		sigma: '#8dc8f2',
		attention: '#f3d36b',
		attentionFill: '#f3d36b',
		highlight: '#4a4022',

		codeBg: '#1f2423',
		codeInk: '#f2f0ea',
		codeKeyword: '#b182ff',
		codeString: '#81a567',
		codeNumber: '#f6781e',
		codeComment: '#ac9879',
		codeLineNumber: '#8b9692',
		codeBorder: '#323a38',
	},
};

// Typography tokens. Families are loaded by src/styles/fonts.css.
export const fonts = {
	serif: "'Literata Variable', Literata, Georgia, serif",
	ui: "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
	mono: "'Atkinson Hyperlegible Mono Variable', 'Atkinson Hyperlegible Mono', ui-monospace, monospace",
	hand: "Kalam, 'Segoe Print', cursive",
};

// Contrast pairs the build must keep passing.
// kind: 'text' needs 4.5:1, 'large' needs 3:1 (18.66px bold / 24px+), 'graphic' needs 3:1,
// 'code' needs 5.5:1 so Expressive Code never silently adjusts the colour.
export const contrastRules = [
	['ink', 'page', 'text'],
	['inkMuted', 'page', 'text'],
	['inkMuted', 'surfaceSunk', 'text'],
	['accent', 'page', 'text'],
	['accent', 'accentLow', 'text'],
	['ledgeInk', 'ledge', 'text'],
	['boardInk', 'board', 'text'],
	['boardInkMuted', 'board', 'text'],
	['boardAxis', 'board', 'graphic'],
	['boardEdge', 'page', 'graphic'],
	['mu', 'page', 'text'],
	['sigma', 'page', 'text'],
	['mu', 'board', 'text'],
	['sigma', 'board', 'text'],
	['attention', 'page', 'graphic'],
	['attention', 'board', 'graphic'],
	['ink', 'highlight', 'text'],
	['codeInk', 'codeBg', 'code'],
	['codeKeyword', 'codeBg', 'code'],
	['codeString', 'codeBg', 'code'],
	['codeNumber', 'codeBg', 'code'],
	['codeComment', 'codeBg', 'code'],
	['codeLineNumber', 'codeBg', 'text'],
	['mu', 'codeBg', 'text'],
	['sigma', 'codeBg', 'text'],
];

// Code colours must never be mistaken for a meaning colour, including under colour blindness.
// Minimum CIEDE2000 distance from mu, sigma and attention.
export const meaningSeparation = {
	tokens: ['codeKeyword', 'codeString', 'codeNumber', 'codeComment', 'codeInk'],
	anchors: ['mu', 'sigma', 'attention'],
	minNormal: 20,
	minColourBlind: 12,
};
