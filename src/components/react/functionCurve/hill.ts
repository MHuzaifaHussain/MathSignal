// Slice mode's pure model: the hill f(x, y) = 8 − x² − 2y², its slices through a point, its partial slopes and its
// contours. The slice board itself (map, linked slice plane, question and copy) is built the week before the partial
// derivatives page, from that page's spec; only this model exists now. Decision 0020.
import { fraction, multiplyFractions, squareRoot, subtractFractions, toNumber, type Fraction } from '../boardMath.ts';
import type { ExactFunction } from './functions.ts';

export interface HillPoint {
	x: Fraction;
	y: Fraction;
}

const whole = (value: number) => fraction(value, 1);
const PEAK = whole(8);
const square = (value: Fraction) => multiplyFractions(value, value);

/** The height 8 − x² − 2y² at a point of the map. */
export function hillHeight(point: HillPoint): Fraction {
	return subtractFractions(subtractFractions(PEAK, square(point.x)), multiplyFractions(whole(2), square(point.y)));
}

export type SliceDirection = 'east' | 'north';

/**
 * The one-input curve through `point` heading east (y held, x varies) or north (x held, y varies), as an ExactFunction,
 * so every one-input tool works on it: east at y₀ is (8 − 2y₀²) − x², north at x₀ is (8 − x₀²) − 2y².
 */
export function sliceOf(point: HillPoint, direction: SliceDirection): ExactFunction {
	if (direction === 'east') {
		const constant = subtractFractions(PEAK, multiplyFractions(whole(2), square(point.y)));
		return {
			id: 'hill-east',
			name: { visible: 'the east slice', spoken: 'the east slice' },
			variable: 'x',
			pieces: [{ from: null, to: null, coefficients: [constant, whole(0), whole(-1)] }],
		};
	}
	const constant = subtractFractions(PEAK, square(point.x));
	return {
		id: 'hill-north',
		name: { visible: 'the north slice', spoken: 'the north slice' },
		variable: 'y',
		pieces: [{ from: null, to: null, coefficients: [constant, whole(0), whole(-2)] }],
	};
}

/** The slopes of the two slices at the point: (−2x, −4y). */
export function partials(point: HillPoint): { east: Fraction; north: Fraction } {
	return { east: multiplyFractions(whole(-2), point.x), north: multiplyFractions(whole(-4), point.y) };
}

export interface Contour {
	height: Fraction;
	/** Half-widths of the ellipse x² + 2y² = 8 − c along x and along y. Irrational in general, so floats for drawing. */
	semiAxisX: number;
	semiAxisY: number;
}

/** The contour at each height c is the ellipse x² + 2y² = 8 − c. Throws for a height at or above the peak, which has none. */
export function contourLevels(heights: readonly Fraction[]): readonly Contour[] {
	return heights.map((height) => {
		const room = subtractFractions(PEAK, height);
		if (room.numerator <= 0) throw new Error(`hill.contourLevels: height ${toNumber(height)} is at or above the peak 8, so it has no contour`);
		return { height, semiAxisX: rootAsNumber(room), semiAxisY: rootAsNumber(multiplyFractions(room, fraction(1, 2))) };
	});
}

function rootAsNumber(value: Fraction): number {
	const root = squareRoot(value);
	return root.exact ? toNumber(root.value) : root.value;
}
