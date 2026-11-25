// VectorBoard2D's math: whole-number vectors on a grid, so sums, scalings, dot products and the exact-angle verdicts
// are integer facts. Pure, with no React and nothing from mafs, so scripts/check-boards.mjs runs it directly.
// Design and reasoning: decision 0014.
//
// Every constraint is "round to the grid, then clamp each component to an interval" (a box). Never write one that
// rejects grid points inside the box, such as leaving out the zero vector: Mafs' keyboard loop tries larger and
// larger steps until the constrained point moves, so a hole makes one arrow press jump several units.
import { divideFractions, fraction, isPerfectSquare, type Fraction } from '../boardMath.ts';
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

// ---- Linear combinations and span ----

/** c a + d b. The weights move in steps of 0.5, so every result is exact in floating point. */
export const combine = (c: number, a: Vec2, d: number, b: Vec2): Vec2 => add(scale(c, a), scale(d, b));

/** What every c a + d b can reach: only the origin, one line through it, or the whole plane. */
export type SpanKind = 'origin' | 'line' | 'plane';

/** Integer tests, in this order: both zero, then lined up (cross product 0), else the whole plane. */
export function spanKind(a: Vec2, b: Vec2): SpanKind {
	if (isZero(a) && isZero(b)) return 'origin';
	return cross(a, b) === 0 ? 'line' : 'plane';
}

/** The exact k with to = k × from, or null when `from` is the zero vector or the two don't line up. */
export function lineMultiple(from: Vec2, to: Vec2): Fraction | null {
	if (isZero(from) || cross(from, to) !== 0) return null;
	const index = from[0] !== 0 ? 0 : 1;
	return divideFractions(fraction(to[index], 1), fraction(from[index], 1));
}

/**
 * The exact weights [c, d] with c a + d b = target, by Cramer's rule, or null when a and b line up (no unique answer).
 * boardMath's divideFractions moves a negative determinant's sign to the numerator.
 */
export function flagWeights(target: Vec2, a: Vec2, b: Vec2): readonly [Fraction, Fraction] | null {
	const determinant = cross(a, b);
	if (determinant === 0) return null;
	const [x, y] = target;
	const over = fraction(determinant, 1);
	return [divideFractions(fraction(x * b[1] - y * b[0], 1), over), divideFractions(fraction(a[0] * y - a[1] * x, 1), over)];
}

export type CombineGuess = 'match' | 'swapped' | 'other';

/**
 * Judges c a + d b against the flag. `swapped` is the flag mirrored across the diagonal, so a verdict that says "east
 * and north swapped" is literally true for any a and b.
 */
export function classifyCombine(a: Vec2, b: Vec2, c: number, d: number, target: Vec2): CombineGuess {
	const sum = combine(c, a, d, b);
	if (equals(sum, target)) return 'match';
	return equals(sum, [target[1], target[0]]) ? 'swapped' : 'other';
}

/** Below this, floating-point noise from the clip: an end this close to an edge is on it, a piece this short is none. */
const CLIP_TOLERANCE = 1e-9;

const snapToEdge = (value: number): number => {
	if (Math.abs(value - VIEW_LIMIT) < CLIP_TOLERANCE) return VIEW_LIMIT;
	return Math.abs(value + VIEW_LIMIT) < CLIP_TOLERANCE ? -VIEW_LIMIT : value + 0;
};

export interface ClippedSegment {
	from: Vec2;
	to: Vec2;
	/** True when the segment's own end is on the board, so an arrowhead there tells the truth. */
	tipShown: boolean;
}

/**
 * The part of the segment from → to inside the closed view [−5, 5]² (Liang–Barsky), or null when no part is inside or
 * the part inside has no length (a corner touch). The box is closed, so a segment along x = 5 is kept whole.
 */
export function clipSegment(from: Vec2, to: Vec2): ClippedSegment | null {
	const direction = subtract(to, from);
	let enter = 0;
	let leave = 1;
	const edges: readonly (readonly [number, number])[] = [
		[-direction[0], from[0] + VIEW_LIMIT],
		[direction[0], VIEW_LIMIT - from[0]],
		[-direction[1], from[1] + VIEW_LIMIT],
		[direction[1], VIEW_LIMIT - from[1]],
	];
	for (const [toward, room] of edges) {
		if (toward === 0) {
			if (room < 0) return null;
			continue;
		}
		const crossing = room / toward;
		if (toward < 0) {
			if (crossing > leave) return null;
			enter = Math.max(enter, crossing);
		} else {
			if (crossing < enter) return null;
			leave = Math.min(leave, crossing);
		}
	}
	const pointAt = (t: number, exact: Vec2): Vec2 => {
		if (t === 0 || t === 1) return exact;
		const point = add(from, scale(t, direction));
		return [snapToEdge(point[0]), snapToEdge(point[1])];
	};
	const start = pointAt(enter, enter === 0 ? from : to);
	const end = pointAt(leave, leave === 1 ? to : from);
	if (Math.sqrt(lengthSquared(subtract(end, start))) < CLIP_TOLERANCE) return null;
	return { from: start, to: end, tipShown: withinView(to) };
}

/** The line through the origin along a nonzero v, cut at the view's edge: ±(5 ÷ max(|v₁|, |v₂|)) v. */
export function spanLineEnds(v: Vec2): readonly [Vec2, Vec2] {
	if (isZero(v)) throw new Error('VectorBoard2D: the zero vector has no direction, so it spans no line.');
	const reach = VIEW_LIMIT / Math.max(Math.abs(v[0]), Math.abs(v[1]));
	const end: Vec2 = [snapToEdge(reach * v[0]), snapToEdge(reach * v[1])];
	return [scale(-1, end), end];
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
	return add(middle, scale(LABEL_OFFSET, labelAway(tail, tip, side)));
}

/** The unit step from an arrow's middle to its label (see labelAnchor): straight up for a zero arrow. */
export function labelAway(tail: Vec2, tip: Vec2, side: 1 | -1): Vec2 {
	const direction = subtract(tip, tail);
	const length = Math.sqrt(lengthSquared(direction));
	if (length === 0) return [0, 1];
	return [(-side * direction[1]) / length + 0, (side * direction[0]) / length + 0];
}

/** Font size of the plane's labels, in pixels. */
export const LABEL_SIZE = 16;
/**
 * Estimated label width per character, in ems. The widest multi-letter label measured in Atkinson Hyperlegible Next
 * is 0.48 em per character; a little more covers the fallback fonts.
 */
const LABEL_CHAR_WIDTH_EM = 0.5;
/** A label's height, in ems (21px measured at 16px). */
const LABEL_HEIGHT_EM = 1.35;
/** Room kept between a label and the plane's edge, in pixels: Mafs' 3px text halo plus a little air. */
const LABEL_EDGE_MARGIN_PX = 4;

/** How a label is drawn: centered on `at`, or ending at `at` ('w') or starting at it ('e'), as in Mafs' Text. */
export interface FittedLabel {
	at: Vec2;
	attach: 'center' | 'w' | 'e';
}

/** A label's half width and half height in grid units, on a square plane `planeSize` pixels wide. */
export function labelHalfSize(text: string, planeSize: number): Vec2 {
	if (!(planeSize > 0)) throw new Error(`VectorBoard2D: the plane must be wider than 0px to place labels, got ${planeSize}.`);
	const unitsPerPixel = (2 * (VIEW_LIMIT + VIEW_PADDING)) / planeSize;
	const width = Array.from(text).length * LABEL_CHAR_WIDTH_EM * LABEL_SIZE;
	return [(width / 2) * unitsPerPixel, ((LABEL_HEIGHT_EM * LABEL_SIZE) / 2) * unitsPerPixel];
}

/** How far a label's box may reach from the center, in grid units: the plane's edge less the margin. */
export function labelReach(planeSize: number): number {
	return VIEW_LIMIT + VIEW_PADDING - (LABEL_EDGE_MARGIN_PX * 2 * (VIEW_LIMIT + VIEW_PADDING)) / planeSize;
}

/** True when `at` is past the edge on the side `away` mostly points to, so the label sits on the arrow's outer side. */
function pointsOutward(at: Vec2, away: Vec2, axis: 0 | 1): boolean {
	const other = axis === 0 ? 1 : 0;
	return Math.abs(away[axis]) >= Math.abs(away[other]) && Math.sign(away[axis]) === Math.sign(at[axis]) && away[axis] !== 0;
}

/**
 * Keeps a label inside the plane at every position the handles can reach. A label that would cross an edge on the
 * outer side of its arrow moves to the inner side (mirrored across the arrow). It is then kept inside vertically, and
 * if it still runs past the left or right edge it grows toward the center from its anchor instead of being centered,
 * so its text stays clear of the arrow it names. `away` is the unit step from the arrow to the label (labelAway), or
 * null for a label that names no arrow.
 */
export function fitLabel(at: Vec2, away: Vec2 | null, text: string, planeSize: number): FittedLabel {
	const [halfWidth, halfHeight] = labelHalfSize(text, planeSize);
	const reach = labelReach(planeSize);
	const crossesX = Math.abs(at[0]) + halfWidth > reach;
	const crossesY = Math.abs(at[1]) + halfHeight > reach;
	const mirror = away !== null && ((crossesX && pointsOutward(at, away, 0)) || (crossesY && pointsOutward(at, away, 1)));
	const anchor = mirror && away ? subtract(at, scale(2 * LABEL_OFFSET, away)) : at;
	const y = clamp(anchor[1], -reach + halfHeight, reach - halfHeight);
	if (Math.abs(anchor[0]) + halfWidth <= reach) return { at: [anchor[0], y], attach: 'center' };
	// Grows toward the center: 'w' ends the text at x, 'e' starts it there. Clamped so both ends stay inside.
	if (anchor[0] > 0) return { at: [clamp(anchor[0], -reach + 2 * halfWidth, reach), y], attach: 'w' };
	return { at: [clamp(anchor[0], -reach, reach - 2 * halfWidth), y], attach: 'e' };
}

/** The x interval a fitted label covers, in grid units. */
export function fittedLabelSpan(label: FittedLabel, text: string, planeSize: number): Vec2 {
	const [halfWidth] = labelHalfSize(text, planeSize);
	if (label.attach === 'w') return [label.at[0] - 2 * halfWidth, label.at[0]];
	if (label.attach === 'e') return [label.at[0], label.at[0] + 2 * halfWidth];
	return [label.at[0] - halfWidth, label.at[0] + halfWidth];
}
