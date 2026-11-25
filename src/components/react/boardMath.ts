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

/**
 * Adds over the least common denominator, so two fractions whose denominators share factors (1/60,500,000 and
 * 1/30,250,000) stay exact long after cross-multiplying would have overflowed.
 */
export function addFractions(a: Fraction, b: Fraction): Fraction {
	const shared = greatestCommonDivisor(a.denominator, b.denominator);
	const aScale = b.denominator / shared;
	const bScale = a.denominator / shared;
	const scaledA = a.numerator * aScale;
	const scaledB = b.numerator * bScale;
	const numerator = scaledA + scaledB;
	const denominator = a.denominator * aScale;
	assertSafe('add', [a, b], scaledA, scaledB, numerator, denominator);
	return fraction(numerator, denominator);
}

export function subtractFractions(a: Fraction, b: Fraction): Fraction {
	return addFractions(a, fraction(-b.numerator, b.denominator));
}

/** Divides a by b. A negative divisor's sign moves to the numerator, because a denominator is always positive. */
export function divideFractions(a: Fraction, b: Fraction): Fraction {
	if (b.numerator === 0) throw new Error(`boardMath: divide by zero (${formatFraction(a)} ÷ ${formatFraction(b)})`);
	const sign = b.numerator < 0 ? -1 : 1;
	return multiplyFractions(a, fraction(sign * b.denominator, sign * b.numerator));
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

/** |value|: the same fraction with a nonnegative numerator. */
export function absoluteFraction(value: Fraction): Fraction {
	return fraction(Math.abs(value.numerator), value.denominator);
}

/** −1, 0 or 1, the sign of the value. */
export function fractionSign(value: Fraction): -1 | 0 | 1 {
	return value.numerator < 0 ? -1 : value.numerator > 0 ? 1 : 0;
}

/** The larger of two fractions, compared exactly (either one when they are equal). */
export function maxFraction(a: Fraction, b: Fraction): Fraction {
	return compareFractions(a, b) >= 0 ? a : b;
}

export function toNumber(value: Fraction): number {
	return value.numerator / value.denominator;
}

/** True for 0, 1, 4, 9, …: a whole number whose square root is whole. */
export function isPerfectSquare(n: number): boolean {
	return Number.isInteger(n) && n >= 0 && Number.isInteger(Math.sqrt(n));
}

/**
 * The square root of a fraction: exact when both parts are perfect squares (√(9/4) = 3/2), so a readout can write
 * "=", and otherwise a float the caller rounds and writes with "≈".
 */
export function squareRoot(value: Fraction): { exact: true; value: Fraction } | { exact: false; value: number } {
	if (value.numerator < 0) throw new Error(`squareRoot: the fraction is negative (${formatFraction(value)})`);
	if (isPerfectSquare(value.numerator) && isPerfectSquare(value.denominator)) {
		return { exact: true, value: fraction(Math.sqrt(value.numerator), Math.sqrt(value.denominator)) };
	}
	return { exact: false, value: Math.sqrt(toNumber(value)) };
}
