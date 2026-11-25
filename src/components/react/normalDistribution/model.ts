// The z mode's numbers (decision 0019): a value is an integer step index on the group's grid, so its distance from the
// mean and its z-score are exact fractions; Φ is a float from an erf series with a stated accuracy. No wording here
// (describe.ts) and no React or Mafs at runtime, so scripts/check-boards.mjs runs it under Node.
import type { vec } from 'mafs';
import { addFractions, divideFractions, fraction, multiplyFractions, toNumber, type Fraction } from '../boardMath.ts';
import { gaussian } from './bell.ts';
import type { ZPreset } from './setups.ts';

/** A value runs from μ − 3σ to μ + 3σ: the z ruler's ends. */
export const Z_LIMIT = 3;

/** The view, in z units on x. Wide enough for the ruler's ends and the row captions left of −3. */
export const Z_VIEW_X: vec.Vector2 = [-4, 4];
/**
 * Room above the 0.399 peak for the μ label, and below the axis for the two ruler rows. At Z_BOARD_HEIGHT that is
 * about 403 px per unit: the axis 50 px above the bottom, the peak 29 px below the top.
 */
export const Z_VIEW_Y: vec.Vector2 = [-0.125, 0.47];
export const Z_BOARD_HEIGHT = 240;
/** The cm ruler sits nearest the axis (about 18 px under it), the z ruler under it (about 38 px), as on the page's picture. */
export const UNIT_ROW_Y = -0.045;
export const Z_ROW_Y = -0.095;
/** Where each row's caption ("cm", "z") sits, left of the −3 tick. */
export const ROW_CAPTION_X = -3.75;
/** The ruler labels' text size in px. */
export const RULER_LABEL_SIZE = 14;
/**
 * The μ and σ labels sit where no marker can reach: μ above the peak, σ beside the span's right end, where the curve
 * is already under the glyph. Each label's box is LABEL_HALF_SIZE around its point, swept in check-boards.
 */
export const MU_LABEL_AT: vec.Vector2 = [0, 0.43];
export const SIGMA_LABEL_AT: vec.Vector2 = [1.2, 0.27];
export const LABEL_HALF_SIZE: vec.Vector2 = [0.15, 0.02];
/** Sample spacing of the shaded area's top edge, in z units. */
const SHADE_SAMPLES_PER_UNIT = 20;

/** The standard normal density φ, the bell's own function at μ = 0, σ = 1. */
export const standardNormalDensity = (z: number) => gaussian(z, 0, 1);

const whole = (n: number) => fraction(n, 1);

/** How many steps fit between the mean and 3σ: 24 for σ = 8 cm in 1 cm steps. setups.ts checks it is whole. */
export function maxIndex(preset: ZPreset): number {
	const steps = divideFractions(whole(Z_LIMIT * preset.sd), preset.step);
	if (steps.denominator !== 1) throw new Error(`normalDistribution.maxIndex: the step ${steps.numerator}/${steps.denominator} doesn't divide 3σ on ${preset.id}`);
	return steps.numerator;
}

function checkIndex(preset: ZPreset, index: number, caller: string): void {
	const limit = maxIndex(preset);
	if (!Number.isInteger(index) || Math.abs(index) > limit) {
		throw new Error(`normalDistribution.${caller}: index ${index} is not a whole number from −${limit} to ${limit} on ${preset.id}`);
	}
}

/** The value's distance from the mean, x − μ = index · step. */
export function distanceAt(preset: ZPreset, index: number): Fraction {
	checkIndex(preset, index, 'distanceAt');
	return multiplyFractions(whole(index), preset.step);
}

/** The value itself, x = μ + index · step. */
export function valueAt(preset: ZPreset, index: number): Fraction {
	return addFractions(whole(preset.mean), distanceAt(preset, index));
}

/** z = (x − μ) / σ, exact. */
export function zAt(preset: ZPreset, index: number): Fraction {
	return divideFractions(distanceAt(preset, index), whole(preset.sd));
}

/** A whole index within ±maxIndex: rounded and clamped, never trusted. `caller` and `input` name a non-finite one. */
export function gridIndex(preset: ZPreset, index: number, caller: string, input: number = index): number {
	if (!Number.isFinite(index)) throw new Error(`normalDistribution.${caller}: ${input} is not a finite position`);
	const limit = maxIndex(preset);
	// `+ 0` turns −0 into 0, so a rounded −0.2 is the plain index 0.
	return Math.min(limit, Math.max(-limit, Math.round(index))) + 0;
}

/** The tray slider's float value as a grid index, so state never holds a float value. */
export function indexFromSlider(preset: ZPreset, value: number): number {
	return gridIndex(preset, (value - preset.mean) / toNumber(preset.step), 'indexFromSlider', value);
}

/** The handle's x, in z units, as a grid index. */
export function indexFromDragX(preset: ZPreset, x: number): number {
	return gridIndex(preset, (x * preset.sd) / toNumber(preset.step), 'indexFromDragX', x);
}

/** Beyond this |z| the board never asks for Φ; a call there is a bug. */
const CDF_Z_LIMIT = 6;
const SERIES_TERM_LIMIT = 200;
const SERIES_RELATIVE_STOP = 1e-17;

/**
 * erf(t) from the all-positive series (2/√π) e^(−t²) Σ 2ⁿ t^(2n+1) / (1·3·…·(2n+1)). Every term has one sign, so
 * nothing cancels; at |t| ≤ 3/√2 it needs at most 33 terms.
 */
function erf(t: number): number {
	const magnitude = Math.abs(t);
	const twiceSquare = 2 * magnitude * magnitude;
	let term = magnitude;
	let sum = term;
	for (let n = 1; n <= SERIES_TERM_LIMIT; n += 1) {
		term *= twiceSquare / (2 * n + 1);
		sum += term;
		if (term < SERIES_RELATIVE_STOP * sum) return (Math.sign(t) * 2 * Math.exp(-magnitude * magnitude) * sum) / Math.sqrt(Math.PI);
	}
	throw new Error(`normalDistribution.erf: the series for ${t} did not settle in ${SERIES_TERM_LIMIT} terms`);
}

/** Φ(z), the share of a standard normal below z. Within 4e−16 of the math.erf form; Φ(0) is exactly 0.5. */
export function standardNormalCdf(z: number): number {
	if (!Number.isFinite(z) || Math.abs(z) > CDF_Z_LIMIT) throw new Error(`normalDistribution.standardNormalCdf: z must be finite and within ±${CDF_Z_LIMIT}, got ${z}`);
	if (z === 0) return 0.5;
	return 0.5 + 0.5 * erf(z / Math.SQRT2);
}

export interface RulerTick {
	z: number;
	/** "−3" … "3", with a real minus sign. */
	zLabel: string;
	/** μ + kσ in the group's units, or null on the standard preset, which has no unit row. */
	unitLabel: string | null;
}

const signedWhole = (n: number) => (n < 0 ? `−${-n}` : String(n));

/** One tick per whole z from −3 to 3. Every tick is a slider stop, because the step divides σ. */
export function rulerTicks(preset: ZPreset): RulerTick[] {
	const ticks: RulerTick[] = [];
	for (let k = -Z_LIMIT; k <= Z_LIMIT; k += 1) {
		ticks.push({ z: k, zLabel: signedWhole(k), unitLabel: preset.kind === 'standard' ? null : signedWhole(preset.mean + k * preset.sd) });
	}
	return ticks;
}

/** The area under φ left of z: from the view's left edge along the curve to the marker, then down to the axis. */
export function shadePolygon(z: number): vec.Vector2[] {
	const left = Z_VIEW_X[0];
	if (!(z > left && z <= Z_LIMIT)) throw new Error(`normalDistribution.shadePolygon: z must be in (${left}, ${Z_LIMIT}], got ${z}`);
	const points: vec.Vector2[] = [[left, 0]];
	for (let sample = 0; left + sample / SHADE_SAMPLES_PER_UNIT < z; sample += 1) {
		const x = left + sample / SHADE_SAMPLES_PER_UNIT;
		points.push([x, standardNormalDensity(x)]);
	}
	points.push([z, standardNormalDensity(z)], [z, 0]);
	return points;
}
