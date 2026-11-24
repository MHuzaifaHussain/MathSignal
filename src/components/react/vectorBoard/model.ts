// VectorBoard2D's math: whole-number vectors on a grid, so sums, scalings, dot products and the exact-angle verdicts
// are integer facts. Pure, with no React and nothing from mafs, so scripts/check-boards.mjs runs it directly.
// Design and reasoning: decision 0014.
//
// Every constraint is "round to the grid, then clamp each component to an interval" (a box). Never write one that
// rejects grid points inside the box, such as leaving out the zero vector: Mafs' keyboard loop tries larger and
// larger steps until the constrained point moves, so a hole makes one arrow press jump several units.
import { isPerfectSquare } from '../boardMath.ts';
import { formatNumber } from '../plotColors.ts';

export type Vec2 = readonly [number, number];

/** The guaranteed view: x and y in [−5, 5]. Everything the board draws must stay inside it. */
export const VIEW_LIMIT = 5;
/** Space around the view so arrowheads and labels at ±5 aren't cut off. */
export const VIEW_PADDING = 0.5;

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const subtract = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (c: number, v: Vec2): Vec2 => [c * v[0] + 0, c * v[1] + 0];
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
/** The 2D cross product (the determinant of [a b]): 0 exactly when a and b lie on one line. */
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const lengthSquared = (v: Vec2): number => dot(v, v);
export const isZero = (v: Vec2): boolean => v[0] === 0 && v[1] === 0;
export const equals = (a: Vec2, b: Vec2): boolean => a[0] === b[0] && a[1] === b[1];

/** Nearest grid point. `+ 0` turns −0 into 0, so it never prints as "−0". */
export const snapToGrid = (v: Vec2): Vec2 => [Math.round(v[0]) + 0, Math.round(v[1]) + 0];

/** A per-component interval: x in [min[0], max[0]], y in [min[1], max[1]]. */
export interface Box {
	readonly min: Vec2;
	readonly max: Vec2;
}

export const symmetricBox = (limit: number): Box => ({ min: [-limit, -limit], max: [limit, limit] });
export const shiftBox = (box: Box, offset: Vec2): Box => ({ min: add(box.min, offset), max: add(box.max, offset) });
export const intersectBoxes = (first: Box, second: Box): Box => ({
	min: [Math.max(first.min[0], second.min[0]), Math.max(first.min[1], second.min[1])],
	max: [Math.min(first.max[0], second.max[0]), Math.min(first.max[1], second.max[1])],
});
export const inBox = (v: Vec2, box: Box): boolean => v[0] >= box.min[0] && v[0] <= box.max[0] && v[1] >= box.min[1] && v[1] <= box.max[1];
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);
export const clampToBox = (v: Vec2, box: Box): Vec2 => [clamp(v[0], box.min[0], box.max[0]), clamp(v[1], box.min[1], box.max[1])];
/** The one constraint shape every handle uses: round, then clamp each component. */
export const snapInto = (v: Vec2, box: Box): Vec2 => clampToBox(snapToGrid(v), box);
export const withinView = (v: Vec2): boolean => inBox(v, symmetricBox(VIEW_LIMIT));

/** Where a segment from the center to v reaches the edge of the view: v itself when it is on the board. */
export function clipToView(v: Vec2): Vec2 {
	const reach = Math.max(Math.abs(v[0]), Math.abs(v[1]));
	return reach <= VIEW_LIMIT ? v : scale(VIEW_LIMIT / reach, v);
}

export type Angle = { exact: 0 | 45 | 90 | 135 | 180 } | { approx: number };

/**
 * The angle between a and b in degrees, or null when either is the zero vector (it has no direction). The exact
 * cases are integer tests on the cross and dot products; any other angle uses atan2(|cross|, dot), which stays
 * accurate near 0° and 180° where acos rounds badly.
 */
export function angleOf(a: Vec2, b: Vec2): Angle | null {
	if (isZero(a) || isZero(b)) return null;
	const along = dot(a, b);
	const across = Math.abs(cross(a, b));
	if (across === 0) return { exact: along > 0 ? 0 : 180 };
	if (along === 0) return { exact: 90 };
	if (across === along) return { exact: 45 };
	if (across === -along) return { exact: 135 };
	return { approx: (Math.atan2(across, along) * 180) / Math.PI };
}

/** The signed length of v's shadow along `onto`: v · onto ÷ ‖onto‖, or null when `onto` has no direction. */
export function shadowLength(onto: Vec2, v: Vec2): number | null {
	return isZero(onto) ? null : dot(onto, v) / Math.sqrt(lengthSquared(onto));
}

/** Where v's shadow along `onto` ends: (v · onto ÷ ‖onto‖²) onto, or null when `onto` has no direction. */
export function shadowTip(onto: Vec2, v: Vec2): Vec2 | null {
	return isZero(onto) ? null : scale(dot(onto, v) / lengthSquared(onto), onto);
}

function requireWholeSquare(n: number): void {
	if (!Number.isInteger(n) || n < 0) throw new Error(`VectorBoard2D: rootText needs a whole number at least 0, got ${n}.`);
}

/** "5" for 25, "√13" for 13: the exact root, unsimplified. */
export function rootSymbol(n: number): string {
	requireWholeSquare(n);
	return isPerfectSquare(n) ? String(Math.sqrt(n)) : `√${n}`;
}

/** "5" for 25, "√13 ≈ 3.61" for 13, "0" for 0. Square roots aren't simplified. */
export function rootText(n: number): string {
	requireWholeSquare(n);
	return isPerfectSquare(n) ? String(Math.sqrt(n)) : `√${n} ≈ ${formatNumber(Math.sqrt(n))}`;
}

/** A vector's length: rootText for whole-number vectors, "≈ 1.12" for half steps (c = 0.5 on the scale setup). */
export function lengthText(v: Vec2): string {
	const squared = lengthSquared(v);
	if (Number.isInteger(squared)) return rootText(squared);
	const length = Math.sqrt(squared);
	return Number.isInteger(length) ? String(length) : `≈ ${formatNumber(length)}`;
}

/** A number with a real minus sign and no trailing zeros: "−1.5", "4", "0.5". */
export function numberText(n: number): string {
	return formatNumber(n, 2).replace(/\.?0+$/, '');
}

/** "4.8" when two decimals show n exactly, "≈ 0.33" when they round it. */
export function decimalText(n: number): string {
	const rounded = Math.abs(Math.round(n * 100) / 100 - n) > 1e-9;
	return rounded ? `≈ ${numberText(n)}` : numberText(n);
}

export type TripGuess = 'match' | 'swapped' | 'first-trip' | 'second-trip' | 'difference' | 'product' | 'start' | 'other';

/** What a guess for the end of trip a then trip b says about the reader's idea, checked in this order. */
export function classifyTripGuess(a: Vec2, b: Vec2, guess: Vec2): TripGuess {
	const sum = add(a, b);
	if (equals(guess, sum)) return 'match';
	if (equals(guess, [sum[1], sum[0]])) return 'swapped';
	if (equals(guess, a)) return 'first-trip';
	if (equals(guess, b)) return 'second-trip';
	if (equals(guess, subtract(a, b)) || equals(guess, subtract(b, a))) return 'difference';
	if (equals(guess, [a[0] * b[0], a[1] * b[1]])) return 'product';
	if (isZero(guess)) return 'start';
	return 'other';
}

export type CartPush = 'match' | 'wrong-length' | 'too-much' | 'too-little' | 'backward';

/**
 * Judges a push against the goal "length √targetLengthSquared, with targetForward of it along the track". All
 * integer tests: the part along the track is push · track ÷ ‖track‖, compared by squaring both sides.
 */
export function classifyCartPush(push: Vec2, track: Vec2, targetLengthSquared: number, targetForward: number): CartPush {
	if (isZero(track)) throw new Error('VectorBoard2D: the cart track is the zero vector, so it has no direction.');
	if (lengthSquared(push) !== targetLengthSquared) return 'wrong-length';
	const along = dot(push, track);
	if (Math.sign(along) !== Math.sign(targetForward) && along !== 0) return 'backward';
	const alongSquared = along * along;
	const targetSquared = targetForward * targetForward * lengthSquared(track);
	if (alongSquared > targetSquared) return 'too-much';
	if (alongSquared < targetSquared) return 'too-little';
	return 'match';
}

export type ScaleGuess = 'match' | 'unchanged' | 'zero' | 'same-direction' | 'flipped-longer' | 'flipped-shorter';

/** Judges a scale c against the target. The only target the board uses is −1: turn around, keep the length. */
export function classifyScale(c: number, target: number): ScaleGuess {
	if (c === target) return 'match';
	if (c === 1) return 'unchanged';
	if (c === 0) return 'zero';
	if (c > 0) return 'same-direction';
	return Math.abs(c) > 1 ? 'flipped-longer' : 'flipped-shorter';
}

/** Distance of a label from the middle of its arrow, in grid units. */
export const LABEL_OFFSET = 0.45;

/**
 * Where to write an arrow's label: off its middle on one side (+1 left of the arrow's direction, −1 right), so two
 * parallel arrows labeled on opposite sides don't collide. The midpoint is computed by hand, because Mafs'
 * vec.lerp returns NaN when both ends are the same point (mafs#188); a zero arrow's label goes above it.
 */
export function labelAnchor(tail: Vec2, tip: Vec2, side: 1 | -1): Vec2 {
	const middle: Vec2 = [(tail[0] + tip[0]) / 2, (tail[1] + tip[1]) / 2];
	const direction = subtract(tip, tail);
	const length = Math.sqrt(lengthSquared(direction));
	if (length === 0) return [middle[0], middle[1] + LABEL_OFFSET];
	return [middle[0] - (side * LABEL_OFFSET * direction[1]) / length, middle[1] + (side * LABEL_OFFSET * direction[0]) / length];
}
