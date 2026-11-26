// The words a screen reader hears for DistributionBoard's notation. Screen readers at their default punctuation level
// drop parentheses, braces and bars and say √, ² or / by symbol name, so "C(10, 6)" came out as "C 10 6" and
// "√(4/3)" as "square root 4 slash 3". The visible lines keep the symbols; SpokenText and the announcements use these
// words. Pure, so `npm run check:boards` checks that no symbol is left in any line a reader can reach.
import type { SpokenLine } from '../guided/spokenLine.ts';

const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const fromSuperscript = (digits: string) => [...digits].map((digit) => SUPERSCRIPT_DIGITS[digit]).join('');

/** Most specific first: "P(X = 6)" before a bare "X(1)", "cm²" before any other power, "√(…)" before "√4". */
const SPOKEN_MATH: readonly (readonly [RegExp, string | ((match: string, ...groups: string[]) => string)])[] = [
	[/C\((\d+), (\d+)\)/g, '$1 choose $2'],
	[/P\(\{([^}]*)\}\)/g, 'the chance of the set $1'],
	[/\{([^{}]*)\}/g, '$1'],
	[/P\(([^()≤]+) ≤ X ≤ ([^()]+)\)/g, 'the chance that X is from $1 to $2'],
	[/P\(X = ([^()]+)\)/g, 'the chance that X is $1'],
	[/\beach P = /g, 'each with a chance of '],
	[/X\(([^()]+)\)/g, 'X of $1'],
	[/\bnp\(1 − p\)/g, 'n p times 1 minus p'],
	[/\bnp\b/g, 'n p'],
	[/√\(([^()]+)\)/g, 'the square root of $1'],
	[/√([\d.]+)/g, 'the square root of $1'],
	[/cm²/g, 'square centimeters'],
	[/([\d.]+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_match, base, power) => `${base} to the power ${fromSuperscript(power)}`],
	[/μ/g, 'mu'],
	[/σ/g, 'sigma'],
	[/ × /g, ' times '],
	[/ \/ /g, ' divided by '],
	// A sentence that now starts with a replacement: "…5. P(X = 1)" became "…5. the chance".
	[/(^|[.!?] )the /g, '$1The '],
];

/** `text` with its notation in words: "C(10, 6) = 210" becomes "10 choose 6 = 210". Words pass through unchanged. */
export function spokenMath(text: string): string {
	return SPOKEN_MATH.reduce((line, [symbol, words]) => (typeof words === 'string' ? line.replace(symbol, words) : line.replace(symbol, words)), text);
}

/** A visible line and its spoken form, for SpokenText. */
export function spokenMathLine(text: string): SpokenLine {
	return { visible: text, spoken: spokenMath(text) };
}

/** A line that already has a spoken form (powers, sequences) with the rest of its notation in words too. */
export function spokenMathTwin(line: SpokenLine): SpokenLine {
	return { visible: line.visible, spoken: spokenMath(line.spoken) };
}
