// FunctionCurve's exact geometry: rulers (secants), how far a ruler's slope misses the tangent's, lines through a
// corner, and which drawn points leave the view. Fractions throughout; floats appear only where Mafs draws.
// Pure, so scripts/check-boards.mjs checks it. Design and reasoning: decision 0020.
import { absoluteFraction, addFractions, compareFractions, divideFractions, formatFraction, fraction, subtractFractions, toNumber, type Fraction } from '../boardMath.ts';
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
	return { kind: order > 0 ? 'above' : 'below', size: absoluteFraction(gap) };
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

/** Which side of its anchor a label sits on: 'e' to the right, 'n' above, 'se' below and to the right, and so on. */
export type Attach = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface FittedLabel {
	at: readonly [number, number];
	attach: Attach;
	/** Where Mafs' Text draws the text with attachDistance 0: the text anchor and baseline that `attach` gives. */
	textAt: readonly [number, number];
}

/** Label font size in pixels on the plane and the strip. */
export const LABEL_SIZE = 15;
/** The gap, in pixels, between a label's box and its anchor, on the attach side. */
export const LABEL_DISTANCE = 6;
/**
 * Advance widths of a 15px label's characters in pixels, in Atkinson Hyperlegible Next as measured in Chromium on
 * 2026-11-26 (getComputedTextLength); a character not listed counts as LABEL_WIDEST_CHARACTER. Every label is
 * measured with LABEL_WIDTH_SAFETY on top, so a fallback font that runs a little wider still fits.
 */
const LABEL_CHARACTER_WIDTHS: Readonly<Record<string, number>> = {
	...Object.fromEntries(Array.from('0123456789', (digit) => [digit, 9.5])),
	'(': 4.5, ')': 4.5, '.': 3.2, ',': 3.2, '−': 9.1, ' ': 4.3,
	a: 7.9, c: 7.2, e: 8.1, g: 8.4, i: 3.8, l: 3.9, n: 8.3, o: 8.3, p: 8.5, r: 5.4, s: 7.1, t: 4.9, u: 8.1, w: 10.6, y: 7.1,
};
const LABEL_WIDEST_CHARACTER = 12.7;
const LABEL_WIDTH_SAFETY = 1.08;

/** A label's width in pixels at LABEL_SIZE. */
export const labelWidth = (text: string): number =>
	Array.from(text).reduce((sum, character) => sum + (LABEL_CHARACTER_WIDTHS[character] ?? LABEL_WIDEST_CHARACTER), 0) * LABEL_WIDTH_SAFETY;
/**
 * Where a 15px label's ink sits around the y it is drawn at, in pixels up from that y, for each dominant baseline
 * Mafs' Text uses ('n' draws on the baseline, 's' hangs, 'e' and 'w' are centered), with Mafs' 3px text halo (1.5px
 * each side) included. Measured in Chromium on 2026-11-26 (canvas measureText, Atkinson Hyperlegible Next): on the
 * baseline the ink runs 3 below to 11 above, hanging 15 below to 1 below, centered 6.9 below to 7.1 above.
 */
const TEXT_EXTENT = { baseline: [-4.5, 12.5], hanging: [-16.5, 0.5], middle: [-8.5, 8.5] } as const;
/** Room kept between a label's box (halo included) and the plane's edge, in pixels. */
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

/** Grid units per pixel across and up. */
export interface Scale {
	x: number;
	y: number;
}

/** Grid units per pixel across and up, on a plane `width` by `height` pixels showing these ranges. */
export function scaleOf(x: readonly [number, number], y: readonly [number, number], width: number, height: number): Scale {
	if (!(width > 0) || !(height > 0)) throw new Error(`FunctionCurve: the plane must be wider than 0px to place labels, got ${width} by ${height}`);
	return { x: (x[1] - x[0]) / width, y: (y[1] - y[0]) / height };
}

/** Grid units per pixel on a square plane `planeSize` pixels wide. */
export function planeScale(view: View, planeSize: number): Scale {
	const { x, y } = viewNumbers(view);
	return scaleOf(x, y, planeSize, planeSize);
}

const sides = (attach: Attach) => ({
	horizontal: attach.includes('e') ? 1 : attach.includes('w') ? -1 : 0,
	vertical: attach.includes('n') ? 1 : attach.includes('s') ? -1 : 0,
});

/**
 * Where to draw a label so its box sits `distance` pixels from the anchor on the attach side (a diagonal's share each
 * way on 'ne', 'se' and the like): the point given to Mafs' Text with attachDistance 0, which takes its text anchor
 * from 'e' or 'w' and its baseline from 'n' or 's'. Mafs' own attachDistance moves 'n' text down and 's' text up, onto
 * the anchor, so it isn't used.
 */
export function labelTextPoint(scale: Scale, at: readonly [number, number], attach: Attach, distance = LABEL_DISTANCE): readonly [number, number] {
	const { horizontal, vertical } = sides(attach);
	const share = horizontal !== 0 && vertical !== 0 ? Math.SQRT1_2 : 1;
	const x = at[0] + horizontal * distance * share * scale.x;
	if (vertical === 0) return [x, at[1]];
	const gap = distance * share * scale.y;
	// 'n': the box's bottom sits `gap` above the anchor; 's': its top sits `gap` below it.
	if (vertical === 1) return [x, at[1] + gap - TEXT_EXTENT.baseline[0] * scale.y];
	return [x, at[1] - gap - TEXT_EXTENT.hanging[1] * scale.y];
}

/** The box a label drawn at `textAt` covers, in grid units, from its text anchor and baseline. */
export function textBox(scale: Scale, textAt: readonly [number, number], attach: Attach, text: string): LabelBox {
	const { horizontal, vertical } = sides(attach);
	const width = labelWidth(text) * scale.x;
	const left = textAt[0] + (horizontal === 1 ? 0 : horizontal === -1 ? -width : -width / 2);
	const [below, above] = vertical === 1 ? TEXT_EXTENT.baseline : vertical === -1 ? TEXT_EXTENT.hanging : TEXT_EXTENT.middle;
	return { left, right: left + width, bottom: textAt[1] + below * scale.y, top: textAt[1] + above * scale.y };
}

/** The box a label covers, in grid units, on a square plane `planeSize` pixels wide (labelTextPoint, then textBox). */
export function labelBox(view: View, at: readonly [number, number], attach: Attach, text: string, planeSize: number, distance = LABEL_DISTANCE): LabelBox {
	const scale = planeScale(view, planeSize);
	return textBox(scale, labelTextPoint(scale, at, attach, distance), attach, text);
}

/**
 * Keeps a label inside the plane at this size: its anchor is moved inward until its box (labelBox) clears every edge
 * by LABEL_EDGE_MARGIN pixels, whichever side it hangs from. Throws when the label can't fit at all. Pure, so
 * scripts/check-boards.mjs checks every reachable label without a browser.
 */
export function fitLabel(view: View, at: readonly [number, number], attach: Attach, text: string, planeSize: number, distance = LABEL_DISTANCE): FittedLabel {
	const { x, y } = viewNumbers(view);
	const box = labelBox(view, at, attach, text, planeSize, distance);
	const scale = planeScale(view, planeSize);
	const marginX = LABEL_EDGE_MARGIN * scale.x;
	const marginY = LABEL_EDGE_MARGIN * scale.y;
	if (box.right - box.left > x[1] - x[0] - 2 * marginX || box.top - box.bottom > y[1] - y[0] - 2 * marginY) {
		throw new Error(`FunctionCurve: the label "${text}" doesn't fit a ${planeSize}px plane`);
	}
	// How far the box must move to clear the low edge, else the high edge; 0 when it already fits.
	const nudge = (low: number, high: number, edgeLow: number, edgeHigh: number) => Math.max(edgeLow - low, 0) + Math.min(edgeHigh - high, 0);
	const moveX = nudge(box.left, box.right, x[0] + marginX, x[1] - marginX);
	const moveY = nudge(box.bottom, box.top, y[0] + marginY, y[1] - marginY);
	const fitted = [at[0] + moveX, at[1] + moveY] as const;
	return { at: fitted, attach, textAt: labelTextPoint(scale, fitted, attach, distance) };
}
