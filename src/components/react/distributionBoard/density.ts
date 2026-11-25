// Densities for DistributionBoard's density mode (decision 0018): sand poured along a 4 cm ruler, as piecewise-linear
// shapes with knots on a quarter-centimeter grid. Every area, mean and variance is an exact Fraction, so the
// sentences can write "7/32 of the sand" and scripts/check-boards.mjs can assert them. Pure TypeScript.
import { addFractions, compareFractions, divideFractions, fraction, multiplyFractions, subtractFractions, toNumber, type Fraction } from '../boardMath.ts';

/** The ruler's length, and the grid every knot, bin edge and interval end sits on. */
export const RULER_CM = 4;
export const QUARTERS_PER_CM = 4;
const ZERO = fraction(0, 1);
const ONE = fraction(1, 1);

export interface Knot {
	x: Fraction;
	/** The pile's height there, in sand per cm. */
	height: Fraction;
}

/**
 * `zero`: the pile starts and ends at height 0. `closed-block`: a flat block, whose height holds up to and including
 * both ends; outside it the height is 0.
 */
export interface PiecewiseLinear {
	knots: readonly Knot[];
	ends: 'zero' | 'closed-block';
}

/** A value known exactly, or only as a float that sentences must write with "≈" (the shape `squareRoot` returns). */
export type Exactness = { exact: true; value: Fraction } | { exact: false; value: number };

/** What the boards read from a continuous shape. Week 3's float shapes (the exponential) answer with exact: false. */
export interface ContinuousShape {
	support: readonly [Fraction, Fraction];
	heightAt(x: Fraction): Exactness;
	cdf(x: Fraction): Exactness;
	mean(): Exactness;
	variance(): Exactness;
}

const isOnGrid = (x: Fraction) => (x.numerator * QUARTERS_PER_CM) % x.denominator === 0;
const sum = (values: readonly Fraction[]) => values.reduce(addFractions, ZERO);
const half = (value: Fraction) => multiplyFractions(value, fraction(1, 2));

function segments(shape: PiecewiseLinear): [Knot, Knot][] {
	return shape.knots.slice(1).map((knot, index) => [shape.knots[index], knot]);
}

/** The trapezoid under one segment, from its left end to `to` (inside the segment), by linear interpolation. */
function areaUpTo([left, right]: [Knot, Knot], to: Fraction): Fraction {
	const width = subtractFractions(to, left.x);
	return multiplyFractions(width, half(addFractions(left.height, interpolate(left, right, to))));
}

function interpolate(left: Knot, right: Knot, x: Fraction): Fraction {
	const span = subtractFractions(right.x, left.x);
	const rise = subtractFractions(right.height, left.height);
	return addFractions(left.height, multiplyFractions(rise, divideFractions(subtractFractions(x, left.x), span)));
}

/** ∫ f over one segment by Simpson's rule, exact for the cubic x²·p(x) and anything of lower degree. */
function simpson([left, right]: [Knot, Knot], power: 1 | 2): Fraction {
	const middle = half(addFractions(left.x, right.x));
	const f = (x: Fraction, height: Fraction) => multiplyFractions(power === 1 ? x : multiplyFractions(x, x), height);
	const inner = addFractions(addFractions(f(left.x, left.height), multiplyFractions(fraction(4, 1), f(middle, half(addFractions(left.height, right.height))))), f(right.x, right.height));
	return multiplyFractions(divideFractions(subtractFractions(right.x, left.x), fraction(6, 1)), inner);
}

/** Throws, naming the shape, unless its knots rise on the quarter grid, stay at least 0, close properly and hold area 1. */
export function validateShape(name: string, shape: PiecewiseLinear): PiecewiseLinear {
	const fail = (problem: string) => {
		throw new Error(`DistributionBoard: shape "${name}" ${problem}.`);
	};
	const { knots } = shape;
	if (knots.length < 2) fail('needs at least two knots');
	knots.forEach((knot, index) => {
		if (!isOnGrid(knot.x)) fail(`has a knot at ${toNumber(knot.x)} cm, off the quarter-centimeter grid`);
		if (knot.height.numerator < 0) fail(`has a negative height at ${toNumber(knot.x)} cm`);
		if (index > 0 && compareFractions(knot.x, knots[index - 1].x) <= 0) fail('has knots that do not increase');
	});
	const first = knots[0];
	const last = knots[knots.length - 1];
	if (compareFractions(first.x, ZERO) < 0 || compareFractions(last.x, fraction(RULER_CM, 1)) > 0) fail('leaves the 0 to 4 cm ruler');
	if (shape.ends === 'zero' && (first.height.numerator !== 0 || last.height.numerator !== 0)) fail('has zero ends that are not 0');
	if (shape.ends === 'closed-block' && knots.some((knot) => compareFractions(knot.height, first.height) !== 0)) fail('is a block whose height changes');
	const area = sum(segments(shape).map((segment) => areaUpTo(segment, segment[1].x)));
	if (compareFractions(area, ONE) !== 0) fail(`holds area ${area.numerator}/${area.denominator}, not 1`);
	return shape;
}

export const supportOf = (shape: PiecewiseLinear): readonly [Fraction, Fraction] => [shape.knots[0].x, shape.knots[shape.knots.length - 1].x];

/** The pile's height at x: 0 outside the support, linear between knots, and a block's height at its closed ends. */
export function heightAt(shape: PiecewiseLinear, x: Fraction): Fraction {
	const [start, end] = supportOf(shape);
	if (compareFractions(x, start) < 0 || compareFractions(x, end) > 0) return ZERO;
	const segment = segments(shape).find(([, right]) => compareFractions(x, right.x) <= 0);
	if (!segment) return ZERO;
	return interpolate(segment[0], segment[1], x);
}

/** The share of the sand left of x. */
export function cdf(shape: PiecewiseLinear, x: Fraction): Fraction {
	return sum(
		segments(shape).map((segment) => {
			const [left, right] = segment;
			if (compareFractions(x, left.x) <= 0) return ZERO;
			return areaUpTo(segment, compareFractions(x, right.x) < 0 ? x : right.x);
		}),
	);
}

/** The share of the sand between a and b (a ≤ b). */
export function areaBetween(shape: PiecewiseLinear, a: Fraction, b: Fraction): Fraction {
	if (compareFractions(a, b) > 0) throw new Error(`areaBetween: the stretch runs backward, from ${toNumber(a)} to ${toNumber(b)}`);
	return subtractFractions(cdf(shape, b), cdf(shape, a));
}

export interface Bin {
	from: Fraction;
	to: Fraction;
	share: Fraction;
	/** share ÷ width, in sand per cm. */
	height: Fraction;
}

/** The ruler cut into bins of `width` cm, every bin listed, empty ones included. */
export function bins(shape: PiecewiseLinear, width: Fraction): Bin[] {
	const count = toNumber(divideFractions(fraction(RULER_CM, 1), width));
	if (!Number.isInteger(count)) throw new Error(`bins: ${toNumber(width)} cm does not divide the ${RULER_CM} cm ruler`);
	return Array.from({ length: count }, (_, index) => {
		const from = multiplyFractions(width, fraction(index, 1));
		const to = multiplyFractions(width, fraction(index + 1, 1));
		const share = areaBetween(shape, from, to);
		return { from, to, share, height: divideFractions(share, width) };
	});
}

/** μ = ∫ x·p(x) dx, exactly. */
export const meanOf = (shape: PiecewiseLinear): Fraction => sum(segments(shape).map((segment) => simpson(segment, 1)));

/** σ² = 𝔼[X²] − μ², exactly. */
export function varianceOf(shape: PiecewiseLinear): Fraction {
	const mu = meanOf(shape);
	return subtractFractions(sum(segments(shape).map((segment) => simpson(segment, 2))), multiplyFractions(mu, mu));
}

/** The shape behind the ContinuousShape interface: every answer exact. */
export function asContinuousShape(shape: PiecewiseLinear): ContinuousShape {
	const exact = (value: Fraction): Exactness => ({ exact: true, value });
	return {
		support: supportOf(shape),
		heightAt: (x) => exact(heightAt(shape, x)),
		cdf: (x) => exact(cdf(shape, x)),
		mean: () => exact(meanOf(shape)),
		variance: () => exact(varianceOf(shape)),
	};
}

/**
 * The outline to draw, from 0 to 4 cm: a block drops to 0 at each end, and the baseline runs out to the ruler's ends,
 * so a polyline through these points draws the whole pile (the knots alone would draw only a block's top).
 */
export function curvePoints(shape: PiecewiseLinear): Knot[] {
	const [start, end] = supportOf(shape);
	const ruler = fraction(RULER_CM, 1);
	const points: Knot[] = [];
	if (compareFractions(start, ZERO) > 0) points.push({ x: ZERO, height: ZERO });
	if (shape.ends === 'closed-block') points.push({ x: start, height: ZERO });
	points.push(...shape.knots);
	if (shape.ends === 'closed-block') points.push({ x: end, height: ZERO });
	if (compareFractions(end, ruler) < 0) points.push({ x: ruler, height: ZERO });
	return points;
}

/** The outline of the stretch from a to b, closed along the baseline: the shaded area under the curve. */
export function shadedPoints(shape: PiecewiseLinear, a: Fraction, b: Fraction): Knot[] {
	const inside = shape.knots.filter((knot) => compareFractions(knot.x, a) > 0 && compareFractions(knot.x, b) < 0);
	return [{ x: a, height: ZERO }, { x: a, height: heightAt(shape, a) }, ...inside, { x: b, height: heightAt(shape, b) }, { x: b, height: ZERO }];
}

/** Where x sits along the ruler, edge to edge with no margin, in percent: the one mapping for bins, curve and marks. */
export const rulerPercent = (x: Fraction | number) => ((typeof x === 'number' ? x : toNumber(x)) / RULER_CM) * 100;
