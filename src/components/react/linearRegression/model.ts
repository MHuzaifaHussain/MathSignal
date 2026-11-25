// The regression board's math: sums, the least-squares line, residuals, r, R², Spearman's ρ on average ranks, the
// least-absolute line and per-group fits. Pure and exact (boardMath Fractions); scripts/check-boards.mjs pins every
// number. The board's UI (setups, copy, plane, table) follows once the week-3 and week-4 page specs exist.
// Design and reasoning: decision 0022.
//
// Definitions pinned for the regression pages:
// - r = Sxy ÷ √(Sxx × Syy), the same whether the sums are divided by n or by n − 1;
// - residual = actual − predicted;
// - R² = 1 − SSE ÷ Syy, undefined when Syy = 0 (no spread to explain) or Sxx = 0 (no line);
// - ρ is r on average ranks (SciPy rankdata's default), and 1 − 6Σd² ÷ (n(n² − 1)) only without ties;
// - the least-absolute line is the best line through two of the points, with ties reported.
//
// Runtime readouts use bounded closed forms: n·Sxy = nΣxy − ΣxΣy (and the same for Sxx, Syy) stay small, so a drag
// never overflows boardMath's safe-integer guard, and SSE = Syy − Sxy² ÷ Sxx. Residual-by-residual sums are used only
// by check-boards, to confirm the identities.
import {
	absoluteFraction,
	addFractions,
	compareFractions,
	divideFractions,
	fraction,
	fractionSign,
	multiplyFractions,
	squareRoot,
	subtractFractions,
	type Fraction,
} from '../boardMath.ts';

/** One point: x then y, exact. Whole numbers for dragged data; hundredths for Anscombe's sets. */
export type DataPoint = readonly [Fraction, Fraction];

export interface Line {
	slope: Fraction;
	intercept: Fraction;
}

const ZERO = fraction(0, 1);
const ONE = fraction(1, 1);
const whole = (n: number) => fraction(n, 1);
const sum = (values: readonly Fraction[]) => values.reduce(addFractions, ZERO);

/** Whole-number data as points, x from `xs` and y from `ys`, in order. */
export function wholePoints(xs: readonly number[], ys: readonly number[]): readonly DataPoint[] {
	if (xs.length !== ys.length) throw new Error(`regression: ${xs.length} x values but ${ys.length} y values.`);
	return xs.map((x, i) => {
		if (!Number.isInteger(x) || !Number.isInteger(ys[i])) throw new Error(`regression: point ${i + 1}, (${x}, ${ys[i]}), is not whole.`);
		return [whole(x), whole(ys[i])];
	});
}

export interface Summary {
	n: number;
	meanX: Fraction;
	meanY: Fraction;
	/** Sums of products of distances from the means: Σ(x − x̄)², Σ(y − ȳ)², Σ(x − x̄)(y − ȳ). */
	sxx: Fraction;
	syy: Fraction;
	sxy: Fraction;
}

function requirePoints(points: readonly DataPoint[], least: number): void {
	if (points.length < least) throw new Error(`regression: needs at least ${least} points, got ${points.length}.`);
}

/** n·Sxx = nΣx² − (Σx)², and the like: each sum built from raw sums, so it stays as small as the data allows. */
function scaledSums(points: readonly DataPoint[]) {
	requirePoints(points, 1);
	const n = whole(points.length);
	const xs = points.map((point) => point[0]);
	const ys = points.map((point) => point[1]);
	const sumX = sum(xs);
	const sumY = sum(ys);
	const scaled = (products: readonly Fraction[], first: Fraction, second: Fraction) => subtractFractions(multiplyFractions(n, sum(products)), multiplyFractions(first, second));
	return {
		n,
		sumX,
		sumY,
		nSxx: scaled(xs.map((x) => multiplyFractions(x, x)), sumX, sumX),
		nSyy: scaled(ys.map((y) => multiplyFractions(y, y)), sumY, sumY),
		nSxy: scaled(points.map(([x, y]) => multiplyFractions(x, y)), sumX, sumY),
	};
}

export function summarize(points: readonly DataPoint[]): Summary {
	const { n, sumX, sumY, nSxx, nSyy, nSxy } = scaledSums(points);
	return {
		n: points.length,
		meanX: divideFractions(sumX, n),
		meanY: divideFractions(sumY, n),
		sxx: divideFractions(nSxx, n),
		syy: divideFractions(nSyy, n),
		sxy: divideFractions(nSxy, n),
	};
}

export type Fit = { kind: 'line'; line: Line } | { kind: 'undefined'; reason: 'same-x' };

/** The least-squares line, or undefined when every x is the same (no line through the points has a slope). */
export function leastSquares(points: readonly DataPoint[]): Fit {
	const { n, sumX, sumY, nSxx, nSxy } = scaledSums(points);
	if (nSxx.numerator === 0) return { kind: 'undefined', reason: 'same-x' };
	const slope = divideFractions(nSxy, nSxx);
	const intercept = divideFractions(subtractFractions(sumY, multiplyFractions(slope, sumX)), n);
	return { kind: 'line', line: { slope, intercept } };
}

export const predict = (line: Line, x: Fraction) => addFractions(line.intercept, multiplyFractions(line.slope, x));

/** Actual minus predicted, point by point. */
export function residuals(points: readonly DataPoint[], line: Line): readonly Fraction[] {
	return points.map(([x, y]) => subtractFractions(y, predict(line, x)));
}

export const sumOfSquares = (values: readonly Fraction[]) => sum(values.map((value) => multiplyFractions(value, value)));
export const sumOfAbsolutes = (values: readonly Fraction[]) => sum(values.map(absoluteFraction));

/** The line through (x₁, y₁) and (x₂, y₂), with x₁ ≠ x₂: the reader's line through its two handles. */
export function lineThrough(first: DataPoint, second: DataPoint): Line {
	const run = subtractFractions(second[0], first[0]);
	if (run.numerator === 0) throw new Error('regression: a line through two points needs two different x values.');
	const slope = divideFractions(subtractFractions(second[1], first[1]), run);
	return { slope, intercept: subtractFractions(first[1], multiplyFractions(slope, first[0])) };
}

/** A line's total squared miss over the points. */
export const squaredMissOfLine = (points: readonly DataPoint[], line: Line) => sumOfSquares(residuals(points, line));

export type Undefined = { kind: 'undefined'; reason: 'same-x' | 'same-y' | 'both' };

function spreadReason(nSxx: Fraction, nSyy: Fraction): Undefined | null {
	const sameX = nSxx.numerator === 0;
	const sameY = nSyy.numerator === 0;
	if (sameX && sameY) return { kind: 'undefined', reason: 'both' };
	if (sameX) return { kind: 'undefined', reason: 'same-x' };
	return sameY ? { kind: 'undefined', reason: 'same-y' } : null;
}

/**
 * SSE of the least-squares line, Syy − Sxy² ÷ Sxx, from the bounded sums. Undefined when every x is the same (there is
 * no line); 0 when every y is the same (the flat line misses no one), which R² must still not turn into "R² = 1".
 */
export function leastSquaresError(points: readonly DataPoint[]): Fraction | Undefined {
	const { n, nSxx, nSyy, nSxy } = scaledSums(points);
	if (nSxx.numerator === 0) return { kind: 'undefined', reason: nSyy.numerator === 0 ? 'both' : 'same-x' };
	return divideFractions(subtractFractions(nSyy, divideFractions(multiplyFractions(nSxy, nSxy), nSxx)), n);
}

/** r² as a reduced fraction, n·Sxy² ÷ (n·Sxx × n·Syy), or why it is undefined. */
export function correlationSquared(points: readonly DataPoint[]): Fraction | Undefined {
	const { nSxx, nSyy, nSxy } = scaledSums(points);
	return spreadReason(nSxx, nSyy) ?? divideFractions(multiplyFractions(nSxy, nSxy), multiplyFractions(nSxx, nSyy));
}

/** R² = 1 − SSE ÷ Syy for the least-squares line, undefined when Sxx = 0 or Syy = 0. Equal to r² (asserted). */
export function rSquared(points: readonly DataPoint[]): Fraction | Undefined {
	const { nSxx, nSyy } = scaledSums(points);
	const undefinedReason = spreadReason(nSxx, nSyy);
	if (undefinedReason) return undefinedReason;
	const error = leastSquaresError(points);
	if ('kind' in error) throw new Error('regression: a spread in x must give a least-squares error.');
	return subtractFractions(ONE, divideFractions(error, summarize(points).syy));
}

export type Correlation = { kind: 'exact'; value: Fraction } | { kind: 'rounded'; value: number } | Undefined;

/**
 * r, with the sign of Sxy. Exact when the reduced r² has a perfect-square numerator and denominator (576/720 = 4/5);
 * otherwise a float the caller writes with "≈".
 */
export function correlation(points: readonly DataPoint[]): Correlation {
	const squared = correlationSquared(points);
	if ('kind' in squared) return squared;
	const sign = fractionSign(scaledSums(points).nSxy);
	const root = squareRoot(squared);
	if (root.exact) return { kind: 'exact', value: multiplyFractions(whole(sign), root.value) };
	return { kind: 'rounded', value: sign * root.value };
}

/** Ranks from 1, with tied values sharing the mean of the ranks they would take (SciPy rankdata 'average'): 9/2. */
export function averageRanks(values: readonly Fraction[]): readonly Fraction[] {
	return values.map((value) => {
		const below = values.filter((other) => compareFractions(other, value) < 0).length;
		const tied = values.filter((other) => compareFractions(other, value) === 0).length;
		// The tied values take ranks below + 1 to below + tied; their mean is below + (tied + 1) ÷ 2.
		return fraction(2 * below + tied + 1, 2);
	});
}

export const hasTies = (values: readonly Fraction[]) => values.some((value, i) => values.findIndex((other) => compareFractions(other, value) === 0) !== i);

/** Spearman's ρ: r on the average ranks of x and of y. */
export function spearman(points: readonly DataPoint[]): Correlation {
	const xRanks = averageRanks(points.map((point) => point[0]));
	const yRanks = averageRanks(points.map((point) => point[1]));
	return correlation(xRanks.map((rank, i): DataPoint => [rank, yRanks[i]]));
}

/** 1 − 6Σd² ÷ (n(n² − 1)), valid only without ties (it is wrong with them), so it throws if either list ties. */
export function spearmanShortcut(points: readonly DataPoint[]): { sumSquaredDifferences: Fraction; rho: Fraction } {
	const xs = points.map((point) => point[0]);
	const ys = points.map((point) => point[1]);
	if (hasTies(xs) || hasTies(ys)) throw new Error('regression: the 6Σd² shortcut is wrong with ties; use spearman().');
	const xRanks = averageRanks(xs);
	const yRanks = averageRanks(ys);
	const sumSquaredDifferences = sumOfSquares(xRanks.map((rank, i) => subtractFractions(rank, yRanks[i])));
	const n = points.length;
	return { sumSquaredDifferences, rho: subtractFractions(ONE, divideFractions(multiplyFractions(whole(6), sumSquaredDifferences), whole(n * (n * n - 1)))) };
}

const sameLine = (first: Line, second: Line) => compareFractions(first.slope, second.slope) === 0 && compareFractions(first.intercept, second.intercept) === 0;

/**
 * The least-absolute line: an L1 fit always has a best line through two of the points, so try every pair with
 * different x and keep the smallest total absolute miss. `tied` is true when a different line reaches the same total
 * (pairs on one line give the same line, which is not a tie). Undefined when every x is the same.
 */
export function leastAbsolute(points: readonly DataPoint[]): { kind: 'line'; line: Line; sumAbs: Fraction; tied: boolean } | { kind: 'undefined'; reason: 'same-x' } {
	let best: { line: Line; sumAbs: Fraction } | null = null;
	let tied = false;
	for (let i = 0; i < points.length; i += 1) {
		for (let j = i + 1; j < points.length; j += 1) {
			if (compareFractions(points[i][0], points[j][0]) === 0) continue;
			const line = lineThrough(points[i], points[j]);
			const sumAbs = sumOfAbsolutes(residuals(points, line));
			const order = best ? compareFractions(sumAbs, best.sumAbs) : -1;
			if (order < 0) {
				best = { line, sumAbs };
				tied = false;
			} else if (order === 0 && best && !sameLine(line, best.line)) {
				tied = true;
			}
		}
	}
	return best ? { kind: 'line', ...best, tied } : { kind: 'undefined', reason: 'same-x' };
}

/** The least-squares fit within each group, in the order groups first appear. */
export function groupFits<G extends string>(points: readonly DataPoint[], groupOf: readonly G[]): ReadonlyMap<G, Fit> {
	if (groupOf.length !== points.length) throw new Error(`regression: ${points.length} points but ${groupOf.length} group labels.`);
	const groups = new Map<G, DataPoint[]>();
	points.forEach((point, i) => groups.set(groupOf[i], [...(groups.get(groupOf[i]) ?? []), point]));
	return new Map([...groups].map(([group, members]) => [group, leastSquares(members)]));
}
