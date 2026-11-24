// Exact fraction arithmetic shared by the boards. Pure TypeScript with no imports, so scripts/check-boards.mjs
// can run it directly under Node.

export interface Fraction {
	numerator: number;
	denominator: number;
}

function greatestCommonDivisor(a: number, b: number): number {
	return b === 0 ? Math.abs(a) : greatestCommonDivisor(b, a % b);
}

export function fraction(numerator: number, denominator: number): Fraction {
	if (!(denominator > 0)) throw new Error(`fraction: denominator must be positive, got ${denominator}`);
	if (numerator === 0) return { numerator: 0, denominator: 1 };
	const divisor = greatestCommonDivisor(numerator, denominator);
	return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function formatFraction(value: Fraction): string {
	return value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}

/**
 * Throws when an intermediate or final integer has left the range where doubles are exact, because a wrong
 * fraction that looks right is worse than a loud failure. Checked before reducing, so the guard is conservative.
 */
function assertSafe(operation: string, inputs: readonly Fraction[], ...integers: number[]): void {
	if (integers.every(Number.isSafeInteger)) return;
	throw new Error(`boardMath: ${operation} overflowed safe integers (${inputs.map(formatFraction).join(', ')})`);
}

export function addFractions(a: Fraction, b: Fraction): Fraction {
	const numerator = a.numerator * b.denominator + b.numerator * a.denominator;
	const denominator = a.denominator * b.denominator;
	assertSafe('add', [a, b], a.numerator * b.denominator, b.numerator * a.denominator, numerator, denominator);
	return fraction(numerator, denominator);
}

export function multiplyFractions(a: Fraction, b: Fraction): Fraction {
	const numerator = a.numerator * b.numerator;
	const denominator = a.denominator * b.denominator;
	assertSafe('multiply', [a, b], numerator, denominator);
	return fraction(numerator, denominator);
}

/** Cross-multiplies, so equal values compare equal however they were written (2/4 and 1/2). */
export function compareFractions(a: Fraction, b: Fraction): -1 | 0 | 1 {
	const left = a.numerator * b.denominator;
	const right = b.numerator * a.denominator;
	assertSafe('compare', [a, b], left, right);
	return left < right ? -1 : left > right ? 1 : 0;
}

export function toNumber(value: Fraction): number {
	return value.numerator / value.denominator;
}
