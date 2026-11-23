// KaTeX options for rehype-katex. Rules: docs/design-system/math-plots-code.md

/** Meaning-coloured variables. Write \vmu and \vsigma in formulas, never \color{}. */
export const katexMacros = {
	'\\vmu': '\\htmlClass{ms-mu}{\\mu}',
	'\\vsigma': '\\htmlClass{ms-sigma}{\\sigma}',
};

/** Only \htmlClass is trusted, so \href, \url, \includegraphics and friends stay disabled. */
const TRUSTED_COMMANDS = new Set(['\\htmlClass']);

/** @type {import('katex').KatexOptions} */
export const katexOptions = {
	macros: katexMacros,
	trust: (context) => TRUSTED_COMMANDS.has(context.command),
	// \htmlClass is a deliberate HTML extension; keep warning about every other non-LaTeX input.
	strict: (errorCode) => (errorCode === 'htmlExtension' ? 'ignore' : 'warn'),
	// Fail the build on unknown commands instead of rendering red error text on the page.
	throwOnError: true,
};
