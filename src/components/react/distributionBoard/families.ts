// Distributions entered by their parameters (DistributionBoard's family mode, decision 0018). Pure TypeScript with
// exact integer weights, so scripts/check-boards.mjs can check every reachable state under Node.
import { fraction, type Fraction } from '../boardMath.ts';
import { distributionFromPmf, type Distribution } from './model.ts';

/** C(n, k) stays a safe integer far past this; the boards stop at 10 and week 3's two dice at 12. */
const MAX_COUNT_N = 16;
/** p = j / P_STEPS: the chance slider moves in steps of 0.05. */
export const P_STEPS = 20;

/** C(n, k): how many sequences of n trials have exactly k successes. */
export function chooseCount(n: number, k: number): number {
	if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n || n > MAX_COUNT_N) {
		throw new Error(`chooseCount: need whole numbers with 0 ≤ k ≤ n ≤ ${MAX_COUNT_N}, got n = ${n}, k = ${k}`);
	}
	let count = 1;
	for (let step = 1; step <= k; step += 1) count = (count * (n - k + step)) / step;
	return count;
}

function assertTrials(n: number, j: number, caller: string): void {
	if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT_N) throw new Error(`${caller}: n must be a whole number from 1 to ${MAX_COUNT_N}, got ${n}`);
	if (!Number.isInteger(j) || j < 1 || j >= P_STEPS) throw new Error(`${caller}: j must be a whole number from 1 to ${P_STEPS - 1}, got ${j}`);
}

/** The chance of success p = j/20 as an exact fraction. */
export const chanceOf = (j: number): Fraction => fraction(j, P_STEPS);

/**
 * The binomial distribution for n trials with chance p = j/20. The chance is reduced first (1/2, not 10/20), so the
 * weights C(n, k)·aᵏ·(d − a)ⁿ⁻ᵏ sit over dⁿ: 2ⁿ for a fair coin, at most 20¹⁰ < 2⁵³ on the boards.
 */
export function binomial(n: number, j: number): Distribution {
	assertTrials(n, j, 'binomial');
	const { numerator: a, denominator: d } = chanceOf(j);
	return distributionFromPmf(Array.from({ length: n + 1 }, (_, k) => ({ value: k, weight: chooseCount(n, k) * a ** k * (d - a) ** (n - k) })));
}

/**
 * μ = np and σ² = np(1 − p), from the closed forms. The generic variance multiplies the total by Σwx², which passes
 * 2⁵³ at n = 10, p = 0.3, so family sentences never call it.
 */
export function binomialMoments(n: number, j: number): { mean: Fraction; variance: Fraction } {
	assertTrials(n, j, 'binomialMoments');
	return { mean: fraction(n * j, P_STEPS), variance: fraction(n * j * (P_STEPS - j), P_STEPS * P_STEPS) };
}

/** The values with the tallest bar: ⌊(n + 1)p⌋, or the pair (n + 1)p − 1 and (n + 1)p when (n + 1)p is whole. */
export function tallestValues(n: number, j: number): readonly number[] {
	assertTrials(n, j, 'tallestValues');
	const scaled = (n + 1) * j;
	if (scaled % P_STEPS !== 0) return [Math.floor(scaled / P_STEPS)];
	const mode = scaled / P_STEPS;
	return mode === n + 1 ? [n] : [mode - 1, mode];
}
