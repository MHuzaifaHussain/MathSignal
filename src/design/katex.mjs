// KaTeX options for rehype-katex, plus a guard that fails the build on broken formulas.
// Rules: docs/design-system/math-plots-code.md

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
};

/**
 * rehype plugin, listed right after rehype-katex. rehype-katex catches every KaTeX error, records a
 * non-fatal message and renders red error text, so a typo such as \vmuu would otherwise ship.
 * This turns those messages into a build failure with the formula's location.
 */
export function rehypeKatexFailOnError() {
	return (_tree, file) => {
		const errors = file.messages.filter((message) => message.source === 'rehype-katex');
		if (errors.length === 0) return;
		const details = errors
			.map((message) => `  ${message.line ?? '?'}:${message.column ?? '?'} ${message.cause?.message ?? message.reason}`)
			.join('\n');
		file.fail(`KaTeX could not render ${errors.length} formula(s) in ${file.path}:\n${details}`);
	};
}
