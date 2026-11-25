// FunctionCurve's exact geometry: rulers (secants), how far a ruler's slope misses the tangent's, lines through a
// corner, and which drawn points leave the view. Fractions throughout; floats appear only where Mafs draws.
// Pure, so scripts/check-boards.mjs checks it. Design and reasoning: decision 0020.
import { addFractions, compareFractions, divideFractions, formatFraction, fraction, subtractFractions, toNumber, type Fraction } from '../boardMath.ts';
import { decimalText } from '../boardText.ts';
import type { SpokenLine } from '../guided/spokenLine.ts';
import { evaluate, slopeAt, type ExactFunction } from './functions.ts';

/**
 * Every number the board prints is written in full. The longest decimals on the week-2 grids have 9 places
 * ((1.501)³ = 3.381754501, and the S-curve's rise −0.006754501); decimalText throws on anything that needs more or
 * never terminates, so a value that can't be printed exactly fails loudly instead of being rounded.
 */
export const CURVE_DECIMAL_PLACES = 9;

export const numberText = (value: Fraction): string => decimalText(value, CURVE_DECIMAL_PLACES);

/** A number as shown and as spoken: "−0.75" and "minus 0.75". */
export function spokenNumber(value: Fraction): SpokenLine {
	const visible = numberText(value);
	return { visible, spoken: visible.replace('−', 'minus ') };
}

export const absolute = (value: Fraction): Fraction => fraction(Math.abs(value.numerator), value.denominator);

export interface CurvePoint {
	x: Fraction;
	y: Fraction;
}

export interface Ruler {
	start: CurvePoint;
	end: CurvePoint;
	rise: Fraction;
	run: Fraction;
	slope: Fraction;
}

/** The ruler from (a, f(a)) to (a + h, f(a + h)): rise over run. A ruler of length 0 has no slope, so h = 0 throws. */
export function ruler(f: ExactFunction, a: Fraction, h: Fraction): Ruler {
	if (h.numerator === 0) throw new Error(`model.ruler: h = 0 on ${f.id} at ${f.variable} = ${formatFraction(a)} has no slope`);
	const start = { x: a, y: evaluate(f, a) };
	const endX = addFractions(a, h);
	const end = { x: endX, y: evaluate(f, endX) };
	const rise = subtractFractions(end.y, start.y);
	return { start, end, rise, run: h, slope: divideFractions(rise, h) };
}

export type Miss = { kind: 'above' | 'below'; size: Fraction } | { kind: 'matches' };

/** How the ruler's slope compares with the tangent's at a, or null at a corner, where there is no tangent. */
export function miss(f: ExactFunction, a: Fraction, h: Fraction): Miss | null {
	const tangent = slopeAt(f, a);
	if (tangent.kind === 'corner') return null;
	const gap = subtractFractions(ruler(f, a, h).slope, tangent.value);
	const order = compareFractions(gap, fraction(0, 1));
	if (order === 0) return { kind: 'matches' };
	return { kind: order > 0 ? 'above' : 'below', size: absolute(gap) };
}

export type CornerLine = 'under' | 'above-right' | 'above-left';

/**
 * Where the line s·x through (0, 0) sits against a two-piece curve with its corner at (0, 0) and straight pieces. It
 * stays on or below the curve everywhere exactly when the left slope ≤ s ≤ the right slope; a steeper line rises above
 * the curve to the right of 0, a shallower one to the left.
 */
export function cornerLine(f: ExactFunction, s: Fraction): CornerLine {
	const origin = fraction(0, 1);
	const corner = slopeAt(f, origin);
	const straight = f.pieces.length === 2 && f.pieces.every((piece) => piece.coefficients.length <= 2);
	if (corner.kind !== 'corner' || !straight || compareFractions(evaluate(f, origin), origin) !== 0) {
		throw new Error(`model.cornerLine: ${f.id} is not two straight pieces meeting at a corner at (0, 0)`);
	}
	if (compareFractions(s, corner.right) > 0) return 'above-right';
	if (compareFractions(s, corner.left) < 0) return 'above-left';
	return 'under';
}

export interface View {
	x: readonly [Fraction, Fraction];
	y: readonly [Fraction, Fraction];
}

/**
 * True when a drawn point lies strictly outside the view. A point exactly on the edge counts as on the board: the
 * plane has no padding, so its dot is half drawn there, and its label is placed inward.
 */
export function offBoard(view: View, point: CurvePoint): boolean {
	const outside = (value: Fraction, [low, high]: readonly [Fraction, Fraction]) => compareFractions(value, low) < 0 || compareFractions(value, high) > 0;
	return outside(point.x, view.x) || outside(point.y, view.y);
}

export const viewNumbers = (view: View) => ({
	x: [toNumber(view.x[0]), toNumber(view.x[1])] as const,
	y: [toNumber(view.y[0]), toNumber(view.y[1])] as const,
});

/** Where a label hangs from its anchor, as in Mafs' Text: 'e' starts the text there, 'se' starts it below and right. */
export type Attach = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface FittedLabel {
	at: readonly [number, number];
	attach: Attach;
}

/** Label font size in pixels on the plane and the strip. */
export const LABEL_SIZE = 15;
/** Mafs' attachDistance for every label: how far, in pixels, the text sits from its anchor. */
export const LABEL_DISTANCE = 6;
/** Rough width of one label character, in pixels, for keeping labels inside the plane. */
const LABEL_CHARACTER_WIDTH = 8.5;
/** Line height of a label, as a multiple of its size. */
const LABEL_LINE_HEIGHT = 1.2;
/** Room kept between a label's box and the plane's edge, in pixels: Mafs' 3px text halo plus a little air. */
export const LABEL_EDGE_MARGIN = 4;

/** An axis number with a real minus sign, on the plane and the strip. */
export const axisNumber = (value: number): string => (value < 0 ? `−${Math.abs(value)}` : String(value));

/** A label's box in grid units. */
export interface LabelBox {
	left: number;
	right: number;
	bottom: number;
	top: number;
}

/**
 * The box a label covers, in grid units, on a square plane `planeSize` pixels wide, placed the way Mafs' Text places
 * it: the text anchor from 'e' or 'w', the baseline from 'n' or 's', and LABEL_DISTANCE pixels along the attach
 * direction (shortened to a diagonal's share on 'ne', 'se' and the like). In SVG pixels y points down, so Mafs moves an
 * 'n' label's baseline down by that distance and an 's' label's top up by it.
 */
export function labelBox(view: View, at: readonly [number, number], attach: Attach, text: string, planeSize: number): LabelBox {
	if (!(planeSize > 0)) throw new Error(`FunctionCurve: the plane must be wider than 0px to place labels, got ${planeSize}`);
	const { x, y } = viewNumbers(view);
	const unitsPerPixelX = (x[1] - x[0]) / planeSize;
	const unitsPerPixelY = (y[1] - y[0]) / planeSize;
	const width = Array.from(text).length * LABEL_CHARACTER_WIDTH * unitsPerPixelX;
	const height = LABEL_SIZE * LABEL_LINE_HEIGHT * unitsPerPixelY;
	const horizontal = attach.includes('e') ? 1 : attach.includes('w') ? -1 : 0;
	const vertical = attach.includes('n') ? 1 : attach.includes('s') ? -1 : 0;
	const share = horizontal !== 0 && vertical !== 0 ? Math.SQRT1_2 : 1;
	const shiftX = horizontal * LABEL_DISTANCE * share * unitsPerPixelX;
	const shiftY = -vertical * LABEL_DISTANCE * share * unitsPerPixelY;
	const left = at[0] + shiftX + (horizontal === 1 ? 0 : horizontal === -1 ? -width : -width / 2);
	const bottom = at[1] + shiftY + (vertical === 1 ? 0 : vertical === -1 ? -height : -height / 2);
	return { left, right: left + width, bottom, top: bottom + height };
}

/**
 * Keeps a label inside the plane at this size: its anchor is moved inward until its box (labelBox) clears every edge
 * by LABEL_EDGE_MARGIN pixels, whichever side it hangs from. Throws when the label can't fit at all. Pure, so
 * scripts/check-boards.mjs checks every reachable label without a browser.
 */
export function fitLabel(view: View, at: readonly [number, number], attach: Attach, text: string, planeSize: number): FittedLabel {
	const { x, y } = viewNumbers(view);
	const box = labelBox(view, at, attach, text, planeSize);
	const marginX = LABEL_EDGE_MARGIN * ((x[1] - x[0]) / planeSize);
	const marginY = LABEL_EDGE_MARGIN * ((y[1] - y[0]) / planeSize);
	if (box.right - box.left > x[1] - x[0] - 2 * marginX || box.top - box.bottom > y[1] - y[0] - 2 * marginY) {
		throw new Error(`FunctionCurve: the label "${text}" doesn't fit a ${planeSize}px plane`);
	}
	// How far the box must move to clear the low edge, else the high edge; 0 when it already fits.
	const nudge = (low: number, high: number, edgeLow: number, edgeHigh: number) => Math.max(edgeLow - low, 0) + Math.min(edgeHigh - high, 0);
	const moveX = nudge(box.left, box.right, x[0] + marginX, x[1] - marginX);
	const moveY = nudge(box.bottom, box.top, y[0] + marginY, y[1] - marginY);
	return { at: [at[0] + moveX, at[1] + moveY], attach };
}
