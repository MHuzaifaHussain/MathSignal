// Expressive Code themes built from src/design/palette.mjs: the "tuned full" palette.
// Rules: docs/design-system/math-plots-code.md, decision: docs/decisions/0003-tuned-full-code-highlighting.md
// Nothing here is bold (bold is reserved for the mu/sigma markers) and nothing is blue or pink.
import { ExpressiveCodeTheme } from '@astrojs/starlight/expressive-code';
import { palette } from './palette.mjs';

/** TextMate scopes per role. Docstrings come last so they win over the generic string scope. */
const SCOPES = {
	ink: [
		'source',
		'variable',
		'variable.parameter',
		'variable.language.special.self',
		'variable.language.special.cls',
		'keyword.operator',
		'punctuation',
		'meta.function-call.generic',
		'entity.name.function',
		'entity.name.type.class',
		'entity.other.inherited-class',
		'support.variable',
		'meta.attribute',
		// JSON keys would otherwise take the string color and turn whole blocks green
		'support.type.property-name.json',
	],
	keyword: [
		'keyword',
		'keyword.control',
		'storage.type',
		'storage.modifier',
		'keyword.operator.logical',
		'keyword.operator.word',
		'storage.type.string',
		'support.function.builtin',
		'support.type.python',
		'support.type.exception',
		'constant.character.format.placeholder.other',
		'punctuation.section.format',
		'constant.character.escape',
	],
	decorator: ['entity.name.function.decorator', 'meta.function.decorator', 'punctuation.definition.decorator'],
	string: ['string', 'string.quoted', 'punctuation.definition.string'],
	number: ['constant.numeric', 'constant.language', 'constant.other.caps', 'support.constant'],
	comment: ['comment', 'punctuation.definition.comment', 'string.quoted.docstring', 'string.quoted.docstring.multi'],
};

/**
 * @param {string} name
 * @param {'light' | 'dark'} type
 * @param {typeof palette.light} colors
 */
function buildTheme(name, type, colors) {
	return new ExpressiveCodeTheme({
		name,
		type,
		colors: {
			'editor.background': colors.codeBg,
			'editor.foreground': colors.codeInk,
			'editorLineNumber.foreground': colors.codeLineNumber,
			'editorLineNumber.activeForeground': colors.codeInk,
			'editor.selectionBackground': colors.highlight,
			'editorGroupHeader.tabsBackground': colors.surfaceSunk,
			'editorGroupHeader.tabsBorder': colors.codeBorder,
			'tab.activeBackground': colors.codeBg,
			'tab.activeForeground': colors.ink,
			'tab.activeBorderTop': colors.codeBorder,
			'tab.border': colors.codeBorder,
			'editorGroup.border': colors.codeBorder,
			'titleBar.activeBackground': colors.surfaceSunk,
			'titleBar.activeForeground': colors.inkMuted,
			'titleBar.border': colors.codeBorder,
			'terminal.background': colors.codeBg,
			'terminal.foreground': colors.codeInk,
			focusBorder: colors.ink,
		},
		tokenColors: [
			{ scope: SCOPES.ink, settings: { foreground: colors.codeInk } },
			{ scope: SCOPES.keyword, settings: { foreground: colors.codeKeyword } },
			{ scope: SCOPES.decorator, settings: { foreground: colors.codeKeyword, fontStyle: 'italic' } },
			{ scope: SCOPES.string, settings: { foreground: colors.codeString } },
			{ scope: SCOPES.number, settings: { foreground: colors.codeNumber } },
			{ scope: SCOPES.comment, settings: { foreground: colors.codeComment, fontStyle: 'italic' } },
		],
	});
}

export const codeThemes = {
	dark: buildTheme('mathsignal-dark', 'dark', palette.dark),
	light: buildTheme('mathsignal-light', 'light', palette.light),
};

/** Token colors the meaning markers must not apply inside (strings and comments, both themes). */
export const nonCodeTokenColors = new Set(
	[palette.light, palette.dark].flatMap((colors) => [colors.codeString, colors.codeComment]).map((hex) => hex.toLowerCase()),
);
