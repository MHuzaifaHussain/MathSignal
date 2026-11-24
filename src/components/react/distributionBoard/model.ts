// The math behind DistributionBoard: outcomes mapped to values, merged into bars, then summarized by mean,
// variance and balance. Pure TypeScript that imports only other pure modules, so scripts/check-boards.mjs can
// run it directly under Node. Everything is exact integer and Fraction arithmetic except standardDeviation.
import { fraction, compareFractions, toNumber, type Fraction } from '../boardMath.ts';
import type { OutcomeId } from '../eventSpace/model.ts';

export interface WeightedOutcome {
	id: OutcomeId;
	/** Short visible label, e.g. "HT" or "3". */
	label: string;
	/** Lower-case words for screen readers. */
	spoken: string;
	/** A non-negative integer: 1 for each face of a fair die, more for a loaded one. */
	weight: number;
}

export interface Bar {
	value: number;
	/** The outcomes that share this value, in outcome order. Empty when the distribution was entered directly. */
	members: readonly OutcomeId[];
	weight: number;
	probability: Fraction;
}

export interface Distribution {
	/** Sorted by value, one bar per distinct value. */
	bars: readonly Bar[];
	totalWeight: number;
}

interface PendingBar {
	value: number;
	members: OutcomeId[];
	weight: number;
}

function assertWholeNumber(name: string, quantity: number, minimum = Number.NEGATIVE_INFINITY): void {
	if (!Number.isSafeInteger(quantity) || quantity < minimum) {
		throw new Error(`distribution: ${name} must be a whole number${minimum > Number.NEGATIVE_INFINITY ? ` of at least ${minimum}` : ''}, got ${quantity}`);
	}
}

/** Merges pending entries that share a value, so a distribution never has two bars at one value. */
function buildDistribution(entries: readonly PendingBar[]): Distribution {
	const pending = new Map<number, PendingBar>();
	for (const entry of entries) {
		assertWholeNumber('a value', entry.value);
		assertWholeNumber('a weight', entry.weight, 0);
		const bar = pending.get(entry.value) ?? { value: entry.value, members: [], weight: 0 };
		bar.members.push(...entry.members);
		bar.weight += entry.weight;
		pending.set(entry.value, bar);
	}
	const totalWeight = [...pending.values()].reduce((total, bar) => total + bar.weight, 0);
	if (totalWeight === 0) throw new Error('distribution: there is no weight to spread over bars');
	assertWholeNumber('the total weight', totalWeight, 1);
	const bars = [...pending.values()]
		.sort((a, b) => a.value - b.value)
		.map((bar) => ({ ...bar, probability: fraction(bar.weight, totalWeight) }));
	return { bars, totalWeight };
}

/** Layer 1: the reader's value for each outcome, merged into bars. A missing value is a bug, so it throws. */
export function distributionOf(outcomes: readonly WeightedOutcome[], mapping: Readonly<Record<OutcomeId, number>>): Distribution {
	return buildDistribution(
		outcomes.map((outcome) => {
			const value = mapping[outcome.id];
			if (value === undefined) throw new Error(`distributionOf: no value for outcome "${outcome.id}"`);
			return { value, members: [outcome.id], weight: outcome.weight };
		}),
	);
}

/** Layer 2 entry point for pages that state a distribution directly, with no outcome list behind it. */
export function distributionFromPmf(entries: readonly { value: number; weight: number }[]): Distribution {
	return buildDistribution(entries.map(({ value, weight }) => ({ value, members: [], weight })));
}

/** Σ weight·value and Σ weight·value², as integers, because the exact variance needs no fractions until the end. */
function weightedMoments(d: Distribution): { sum: number; sumOfSquares: number } {
	const sum = d.bars.reduce((total, bar) => total + bar.weight * bar.value, 0);
	const sumOfSquares = d.bars.reduce((total, bar) => total + bar.weight * bar.value * bar.value, 0);
	return { sum, sumOfSquares };
}

function assertSafe(operation: string, ...integers: number[]): void {
	if (!integers.every(Number.isSafeInteger)) throw new Error(`distribution: ${operation} overflowed safe integers`);
}

export function mean(d: Distribution): Fraction {
	const { sum } = weightedMoments(d);
	assertSafe('mean', sum);
	return fraction(sum, d.totalWeight);
}

/** E[X²] − μ², written over T² as (T·Σwx² − (Σwx)²) / T² so the whole computation stays in integers. */
export function variance(d: Distribution): Fraction {
	const { sum, sumOfSquares } = weightedMoments(d);
	const numerator = d.totalWeight * sumOfSquares - sum * sum;
	const denominator = d.totalWeight * d.totalWeight;
	assertSafe('variance', sum, sumOfSquares, d.totalWeight * sumOfSquares, sum * sum, numerator, denominator);
	return fraction(numerator, denominator);
}

/** The only floating-point summary: a square root is irrational in general, so there is nothing exact to keep. */
export function standardDeviation(d: Distribution): number {
	return Math.sqrt(toNumber(variance(d)));
}

/** The pencil sits at k/W. W is a positive integer step denominator and k is the reader's whole-number position. */
function pencilPosition(k: number, W: number): Fraction {
	if (!Number.isInteger(k)) throw new Error(`pencil: k must be an integer, got ${k}`);
	if (!Number.isInteger(W) || W <= 0) throw new Error(`pencil: W must be a positive integer, got ${W}`);
	return fraction(k, W);
}

/**
 * The sign of μ − k/W: 1 means the balance point is right of the pencil, so the plank tips down on the right.
 * Compared exactly, so a pencil at the mean is level rather than off by a rounding error.
 */
export function torqueSign(d: Distribution, k: number, W: number): -1 | 0 | 1 {
	return compareFractions(mean(d), pencilPosition(k, W));
}

export type GuessKind = 'balanced' | 'midrange' | 'tallest-bar' | 'other';

function isMidrange(d: Distribution, guess: Fraction, balancePoint: Fraction): boolean {
	const midpoint = fraction(d.bars[0].value + d.bars[d.bars.length - 1].value, 2);
	return compareFractions(midpoint, balancePoint) !== 0 && compareFractions(midpoint, guess) === 0;
}

function isUnderTallestBar(d: Distribution, guess: Fraction, balancePoint: Fraction): boolean {
	const heaviest = Math.max(...d.bars.map((bar) => bar.weight));
	const tallest = d.bars.filter((bar) => bar.weight === heaviest);
	if (tallest.length !== 1) return false;
	const barValue = fraction(tallest[0].value, 1);
	return compareFractions(barValue, balancePoint) !== 0 && compareFractions(barValue, guess) === 0;
}

/**
 * Names the reader's most instructive wrong guess. Precedence: balanced, then the midpoint of the range, then
 * the tallest bar, then anything else. The midrange and tallest-bar notes stay silent when they would coincide
 * with the mean (a symmetric die) or when no single bar is tallest.
 */
export function classifyGuess(d: Distribution, k: number, W: number): GuessKind {
	const guess = pencilPosition(k, W);
	const balancePoint = mean(d);
	if (compareFractions(balancePoint, guess) === 0) return 'balanced';
	if (isMidrange(d, guess, balancePoint)) return 'midrange';
	if (isUnderTallestBar(d, guess, balancePoint)) return 'tallest-bar';
	return 'other';
}
