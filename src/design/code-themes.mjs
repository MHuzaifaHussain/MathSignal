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
		// JSON keys would otherwise take the string colour and turn whole blocks green
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
 * @param {typeof palette.light} colours
 */
function buildTheme(name, type, colours) {
	return new ExpressiveCodeTheme({
		name,
		type,
		colors: {
			'editor.background': colours.codeBg,
			'editor.foreground': colours.codeInk,
			'editorLineNumber.foreground': colours.codeLineNumber,
			'editorLineNumber.activeForeground': colours.codeInk,
			'editor.selectionBackground': colours.highlight,
			'editorGroupHeader.tabsBackground': colours.surfaceSunk,
			'editorGroupHeader.tabsBorder': colours.codeBorder,
			'tab.activeBackground': colours.codeBg,
			'tab.activeForeground': colours.ink,
			'tab.activeBorderTop': colours.codeBorder,
			'tab.border': colours.codeBorder,
			'editorGroup.border': colours.codeBorder,
			'titleBar.activeBackground': colours.surfaceSunk,
			'titleBar.activeForeground': colours.inkMuted,
			'titleBar.border': colours.codeBorder,
			'terminal.background': colours.codeBg,
			'terminal.foreground': colours.codeInk,
			focusBorder: colours.ink,
		},
		tokenColors: [
			{ scope: SCOPES.ink, settings: { foreground: colours.codeInk } },
			{ scope: SCOPES.keyword, settings: { foreground: colours.codeKeyword } },
			{ scope: SCOPES.decorator, settings: { foreground: colours.codeKeyword, fontStyle: 'italic' } },
			{ scope: SCOPES.string, settings: { foreground: colours.codeString } },
			{ scope: SCOPES.number, settings: { foreground: colours.codeNumber } },
			{ scope: SCOPES.comment, settings: { foreground: colours.codeComment, fontStyle: 'italic' } },
		],
	});
}

export const codeThemes = {
	dark: buildTheme('mathsignal-dark', 'dark', palette.dark),
	light: buildTheme('mathsignal-light', 'light', palette.light),
};

/** Token colours the meaning markers must not apply inside (strings and comments, both themes). */
export const nonCodeTokenColours = new Set(
	[palette.light, palette.dark].flatMap((colours) => [colours.codeString, colours.codeComment]).map((hex) => hex.toLowerCase()),
);
