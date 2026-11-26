// The words a screen reader hears for the statistics and probability boards' notation (DistributionBoard,
// DescriptiveStats, the z table; EventSpace and VectorBoard2D use only spokenFractions). Screen readers at their
// default punctuation level drop parentheses, braces and bars and say √, ², / or ÷ by symbol name, so "C(10, 6)" came out as "C 10 6", "√(4/3)" as "square root 4 slash 3",
// "sand ÷ width" as "sand divide by width" and "|z|" as "z". A fraction such as "13/18" is said "13 over 18", as the
// boards already say "1 over n", and ÷ is "divided by". The visible lines keep the symbols; SpokenText and the
// announcements use these words. Pure, so `npm run check:boards` checks that no symbol is left in any line a reader
// can reach.
import type { SpokenLine } from './guided/spokenLine.ts';

const SUPERSCRIPT_DIGITS: Readonly<Record<string, string>> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const fromSuperscript = (digits: string) => [...digits].map((digit) => SUPERSCRIPT_DIGITS[digit]).join('');

type SpokenRule = readonly [RegExp, string | ((match: string, ...groups: string[]) => string)];

/** Fractions of numbers and ÷, which NVDA reads as "slash" and "divide by". */
const FRACTION_RULES: readonly SpokenRule[] = [
	// A fraction of numbers, "13/18" or "1,024/2,048"; the guard keeps a thousands group or decimal whole.
	[/(?<!\d|\d[.,])(\d{1,3}(?:,\d{3})+|\d+)\/(\d{1,3}(?:,\d{3})+|\d+)(?!\d|[.,]\d)/g, '$1 over $2'],
	[/ *÷ */g, ' divided by '],
];

/** Most specific first: "P(X = 6)" before a bare "X(1)", "cm²" before any other power, "√(…)" before "√4". */
const SPOKEN_MATH: readonly SpokenRule[] = [
	[/C\((\d+), (\d+)\)/g, '$1 choose $2'],
	[/P\(\{([^}]*)\}\)/g, 'the chance of the set $1'],
	[/\{([^{}]*)\}/g, '$1'],
	[/P\(([^()≤]+) ≤ X ≤ ([^()]+)\)/g, 'the chance that X is from $1 to $2'],
	[/P\(X = ([^()]+)\)/g, 'the chance that X is $1'],
	[/\beach P = /g, 'each with a chance of '],
	[/X\(([^()]+)\)/g, 'X of $1'],
	[/Φ\(([^()]+)\)/g, 'Phi of $1'],
	[/\bnp\(1 − p\)/g, 'n p times 1 minus p'],
	// "μ = np", not NumPy's "np.std".
	[/\bnp\b(?!\.)/g, 'n p'],
	[/√\(([^()]+)\)/g, 'the square root of $1'],
	[/√([\d.]+)/g, 'the square root of $1'],
	[/cm²/g, 'square centimeters'],
	[/([σs])²/g, '$1 squared'],
	[/([\d.]+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_match, base, power) => `${base} to the power ${fromSuperscript(power)}`],
	// x̄ is x and a combining macron, which no screen reader names.
	[/x̄/g, 'x bar'],
	// The bars around z are the absolute value, which the outlier rule turns on: it flags large negative z too.
	[/\bevery \|z\|/g, 'every z, ignoring its sign,'],
	[/\|z\|/g, 'the size of z'],
	[/ > /g, ' above '],
	[/μ/g, 'mu'],
	[/σ/g, 'sigma'],
	[/ × /g, ' times '],
	[/ \/ /g, ' divided by '],
	...FRACTION_RULES,
	// A sentence that now starts with a replacement: "…5. P(X = 1)" became "…5. the chance".
	[/(^|[.!?] )the /g, '$1The '],
];

/** `text` with its notation in words: "C(10, 6) = 210" becomes "10 choose 6 = 210". Words pass through unchanged. */
export function spokenMath(text: string): string {
	return applyRules(SPOKEN_MATH, text);
}

/**
 * `text` with only its fractions and ÷ in words: "6/12" becomes "6 over 12", "a ÷ b" becomes "a divided by b". For
 * boards with their own words for the rest of their notation (EventSpace, VectorBoard2D), where spokenMath's other
 * rules would change words those boards choose themselves.
 */
export function spokenFractions(text: string): string {
	return applyRules(FRACTION_RULES, text);
}

function applyRules(rules: readonly SpokenRule[], text: string): string {
	return rules.reduce((line, [symbol, words]) => (typeof words === 'string' ? line.replace(symbol, words) : line.replace(symbol, words)), text);
}

/** A visible line and its spoken form, for SpokenText. */
export function spokenMathLine(text: string): SpokenLine {
	return { visible: text, spoken: spokenMath(text) };
}

/** A line that already has a spoken form (powers, sequences) with the rest of its notation in words too. */
export function spokenMathTwin(line: SpokenLine): SpokenLine {
	return { visible: line.visible, spoken: spokenMath(line.spoken) };
}
