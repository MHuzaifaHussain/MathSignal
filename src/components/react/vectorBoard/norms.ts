// Three ways to measure a vector, and the shapes ("balls") of every point one length from the origin. Shared by
// VectorBoard2D's `city-walk` setup and the NormBall model. Pure and exact: every length is a Fraction, and the L2 norm
// is kept squared, so no comparison ever rests on a rounded square root. Design and reasoning: decision 0021.
//
// For every v the three nest: ‖v‖∞ ≤ ‖v‖₂ ≤ ‖v‖₁. So at one length r the diamond (L1) sits inside the circle (L2), and
// the circle inside the square (L∞).
import { absoluteFraction, addFractions, compareFractions, fraction, maxFraction, multiplyFractions, type Fraction } from '../boardMath.ts';
import type { Vec2 } from './model.ts';

/** l1: walk the streets, |x| + |y|. l2: fly straight, √(x² + y²). linf: a chess king, max(|x|, |y|). */
export type Measure = 'l1' | 'l2' | 'linf';
export const MEASURES: readonly Measure[] = ['l1', 'l2', 'linf'];

/** A point with exact coordinates, such as a NormBall weight (0.4 is 2/5). */
export type ExactPoint = readonly [Fraction, Fraction];

/** A grid point as exact coordinates. Throws on a non-integer, which a grid point never is. */
export function exactPoint(v: Vec2): ExactPoint {
	if (!v.every(Number.isInteger)) throw new Error(`norms: (${v[0]}, ${v[1]}) is not a whole-number point.`);
	return [fraction(v[0], 1), fraction(v[1], 1)];
}

/** The three measures of v, exactly. The L2 norm is kept as its square, x² + y². */
export interface NormParts {
	l1: Fraction;
	l2Squared: Fraction;
	linf: Fraction;
}

export function normParts(v: ExactPoint): NormParts {
	const [x, y] = v.map(absoluteFraction);
	return {
		l1: addFractions(x, y),
		l2Squared: addFractions(multiplyFractions(x, x), multiplyFractions(y, y)),
		linf: maxFraction(x, y),
	};
}

export type BallSide = 'inside' | 'on' | 'outside';

const SIDES: Readonly<Record<-1 | 0 | 1, BallSide>> = { [-1]: 'inside', 0: 'on', 1: 'outside' };

/** Whether v is inside, on or outside the ball of length r: |x| + |y|, x² + y² (against r²) or max(|x|, |y|) against r. */
export function ballSide(v: ExactPoint, measure: Measure, r: Fraction): BallSide {
	if (r.numerator < 0) throw new Error(`norms: a ball's length must be at least 0, got ${r.numerator}/${r.denominator}.`);
	const parts = normParts(v);
	switch (measure) {
		case 'l1':
			return SIDES[compareFractions(parts.l1, r)];
		case 'l2':
			return SIDES[compareFractions(parts.l2Squared, multiplyFractions(r, r))];
		case 'linf':
			return SIDES[compareFractions(parts.linf, r)];
	}
}

export type BallOutline = { kind: 'polygon'; points: readonly Vec2[] } | { kind: 'circle'; radius: number };

/** The ball's outline, for drawing: the diamond's tips on the axes, the square's corners at (±r, ±r), or a circle. */
export function ballOutline(measure: Measure, r: number): BallOutline {
	if (!(r >= 0)) throw new Error(`norms: a ball's length must be at least 0, got ${r}.`);
	switch (measure) {
		case 'l1':
			return { kind: 'polygon', points: [[r, 0], [0, r], [-r, 0], [0, -r]] };
		case 'l2':
			return { kind: 'circle', radius: r };
		case 'linf':
			return { kind: 'polygon', points: [[r, r], [-r, r], [-r, -r], [r, -r]] };
	}
}

/**
 * Every whole-number point exactly on the ball of whole length r, with both coordinates within ±limit, row by row from
 * the top and left to right. L1 at r = 4 has 16; L2 at r = 5 has 12; L∞ at r = 4 has 32.
 */
export function latticeOnBall(measure: Measure, r: number, limit: number): readonly Vec2[] {
	if (!Number.isInteger(r) || r < 0 || !Number.isInteger(limit) || limit < 0) {
		throw new Error(`norms: latticeOnBall takes whole numbers from 0 up, got r = ${r}, limit = ${limit}.`);
	}
	const points: Vec2[] = [];
	const length = fraction(r, 1);
	for (let y = limit; y >= -limit; y--) {
		for (let x = -limit; x <= limit; x++) {
			if (ballSide(exactPoint([x, y]), measure, length) === 'on') points.push([x + 0, y + 0]);
		}
	}
	return points;
}
