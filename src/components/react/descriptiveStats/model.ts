// DescriptiveStats' math: summaries of a short list of whole numbers, exact wherever the answer is a fraction.
// Pure, with no React, so scripts/check-boards.mjs runs it and a build-time page can import it.
// Definitions pinned for every statistics page (decision 0015):
// - quantiles use NumPy's default "linear" method (Hyndman and Fan type 7), as pandas' describe() does;
// - σ divides by n (NumPy's default) and s by n − 1 (pandas' default);
// - "no mode" when every value appears equally often;
// - Tukey fences sit 1.5 × IQR past the quartiles, and a value is flagged only when strictly past one.
import { addFractions, compareFractions, fraction, multiplyFractions, squareRoot, toNumber, type Fraction } from '../boardMath.ts';

/** A square root: exact when it is a fraction, otherwise a float that readouts round and write with "≈". */
export type Root = ReturnType<typeof squareRoot>;

/** The fences' distance past the quartiles, in IQRs. */
export const FENCE_FACTOR = fraction(3, 2);
const ONE_QUARTER = fraction(1, 4);
const ONE_HALF = fraction(1, 2);
const THREE_QUARTERS = fraction(3, 4);

function requireWholeNumbers(values: readonly number[]): void {
	if (values.length === 0) throw new Error('DescriptiveStats: the list of values is empty.');
	const bad = values.find((value) => !Number.isSafeInteger(value));
	if (bad !== undefined) throw new Error(`DescriptiveStats: values must be whole numbers, got ${bad}.`);
}

function requireSafe(operation: string, ...integers: number[]): void {
	if (integers.every(Number.isSafeInteger)) return;
	throw new Error(`DescriptiveStats: ${operation} overflowed safe integers.`);
}

const negate = (value: Fraction): Fraction => fraction(-value.numerator, value.denominator);
const subtractFractions = (a: Fraction, b: Fraction): Fraction => addFractions(a, negate(b));
const whole = (value: number): Fraction => fraction(value, 1);

/** Smallest first. The input is left as it is. */
export function sortedValues(values: readonly number[]): number[] {
	requireWholeNumbers(values);
	return [...values].sort((a, b) => a - b);
}

export function sum(values: readonly number[]): number {
	requireWholeNumbers(values);
	const total = values.reduce((running, value) => running + value, 0);
	requireSafe('sum', total);
	return total;
}

function sumOfSquares(values: readonly number[]): number {
	requireWholeNumbers(values);
	const total = values.reduce((running, value) => running + value * value, 0);
	requireSafe('sum of squares', total);
	return total;
}

export function mean(values: readonly number[]): Fraction {
	return fraction(sum(values), values.length);
}

/**
 * The value a fraction p of the way along the sorted list, NumPy's "linear" method: h = (n − 1) p, then the value at
 * h, interpolating between the two neighbors when h isn't whole.
 */
export function quantile(values: readonly number[], p: Fraction): Fraction {
	if (compareFractions(p, whole(0)) < 0 || compareFractions(p, whole(1)) > 0) {
		throw new Error(`DescriptiveStats: a quantile needs p from 0 to 1, got ${p.numerator}/${p.denominator}.`);
	}
	const ordered = sortedValues(values);
	const h = multiplyFractions(whole(ordered.length - 1), p);
	const below = Math.floor(toNumber(h));
	const along = subtractFractions(h, whole(below));
	if (along.numerator === 0) return whole(ordered[below]);
	return addFractions(whole(ordered[below]), multiplyFractions(along, whole(ordered[below + 1] - ordered[below])));
}

/** The middle value, or the average of the two middle values when n is even. */
export function median(values: readonly number[]): Fraction {
	return quantile(values, ONE_HALF);
}

export function quartiles(values: readonly number[]): { q1: Fraction; median: Fraction; q3: Fraction } {
	return { q1: quantile(values, ONE_QUARTER), median: median(values), q3: quantile(values, THREE_QUARTERS) };
}

export function iqr(values: readonly number[]): Fraction {
	const { q1, q3 } = quartiles(values);
	return subtractFractions(q3, q1);
}

/** Tukey's fences: k × IQR below Q1 and above Q3. */
export function fences(values: readonly number[], k: Fraction = FENCE_FACTOR): { lower: Fraction; upper: Fraction } {
	const { q1, q3 } = quartiles(values);
	const reach = multiplyFractions(k, iqr(values));
	return { lower: subtractFractions(q1, reach), upper: addFractions(q3, reach) };
}

/** For each value, whether it is strictly past a fence. A value on a fence is not flagged. */
export function iqrFlags(values: readonly number[]): boolean[] {
	const { lower, upper } = fences(values);
	return values.map((value) => compareFractions(whole(value), lower) < 0 || compareFractions(whole(value), upper) > 0);
}

function counts(values: readonly number[]): Map<number, number> {
	const tally = new Map<number, number>();
	for (const value of sortedValues(values)) tally.set(value, (tally.get(value) ?? 0) + 1);
	return tally;
}

/** How many times the most common value appears. */
export function topCount(values: readonly number[]): number {
	return Math.max(...counts(values).values());
}

/** Every value with the top count, smallest first; [] when every value appears equally often (no mode). */
export function modes(values: readonly number[]): number[] {
	const tally = counts(values);
	const top = topCount(values);
	if ([...tally.values()].every((count) => count === top)) return [];
	return [...tally.entries()].filter(([, count]) => count === top).map(([value]) => value);
}

export function range(values: readonly number[]): number {
	const ordered = sortedValues(values);
	return ordered[ordered.length - 1] - ordered[0];
}

/** Halfway between the smallest and largest value. */
export function midrange(values: readonly number[]): Fraction {
	const ordered = sortedValues(values);
	return fraction(ordered[0] + ordered[ordered.length - 1], 2);
}

/** n Σx² − (Σx)²: n² times the variance, an integer. */
function scaledSpread(values: readonly number[]): number {
	const n = values.length;
	const total = sum(values);
	const squares = sumOfSquares(values);
	requireSafe('variance', n * squares, total * total);
	return n * squares - total * total;
}

/** σ²: the average squared distance from the mean, dividing by n. The whole group in view. */
export function populationVariance(values: readonly number[]): Fraction {
	const n = values.length;
	requireSafe('variance', n * n);
	return fraction(scaledSpread(values), n * n);
}

/** s²: the same squared distances divided by n − 1, the version for a sample of a bigger group. */
export function sampleVariance(values: readonly number[]): Fraction {
	const n = values.length;
	if (n < 2) throw new Error('DescriptiveStats: the sample variance needs at least two values.');
	requireSafe('variance', n * (n - 1));
	return fraction(scaledSpread(values), n * (n - 1));
}

/** σ, exact when the variance is a square of a fraction. */
export function populationSD(values: readonly number[]): Root {
	return squareRoot(populationVariance(values));
}

/** s, exact when the sample variance is a square of a fraction. */
export function sampleSD(values: readonly number[]): Root {
	return squareRoot(sampleVariance(values));
}

/** How many σ a value sits from the mean, with σ dividing by n. Exact when σ is. */
export function zScore(value: number, values: readonly number[]): Root {
	const sigma = populationSD(values);
	const distance = subtractFractions(whole(value), mean(values));
	if (sigma.exact) {
		if (sigma.value.numerator === 0) throw new Error('DescriptiveStats: a z-score needs spread, but σ is 0.');
		return { exact: true, value: multiplyFractions(distance, fraction(sigma.value.denominator, sigma.value.numerator)) };
	}
	return { exact: false, value: toNumber(distance) / sigma.value };
}

const rootNumber = (root: Root): number => (root.exact ? toNumber(root.value) : root.value);

/** For each value, whether its |z| is strictly above the cutoff. */
export function zFlags(values: readonly number[], cutoff: number): boolean[] {
	return values.map((value) => Math.abs(rootNumber(zScore(value, values))) > cutoff);
}

/** Where a value sits between the smallest (0) and the largest (1), reduced. */
export function minMax(value: number, values: readonly number[]): Fraction {
	const ordered = sortedValues(values);
	const lowest = ordered[0];
	const spread = ordered[ordered.length - 1] - lowest;
	if (spread === 0) throw new Error('DescriptiveStats: min–max scaling divides by zero when every value is the same.');
	return fraction(value - lowest, spread);
}

/** How many values are below, above and equal to the value at `index` (not counting itself). */
export function rankOf(values: readonly number[], index: number): { shorter: number; taller: number; same: number } {
	requireWholeNumbers(values);
	const own = values[index];
	if (own === undefined) throw new Error(`DescriptiveStats: no value at index ${index}.`);
	const others = values.filter((_, other) => other !== index);
	return {
		shorter: others.filter((value) => value < own).length,
		taller: others.filter((value) => value > own).length,
		same: others.filter((value) => value === own).length,
	};
}
