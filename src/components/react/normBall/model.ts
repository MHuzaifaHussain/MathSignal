// NormBall's math: a quadratic loss with axis-aligned contours, the penalized weights it leads to, and the path a
// point slides along on the Lagrange page. Pure and exact (Fractions only; floats only for drawing contour radii), so
// scripts/check-boards.mjs pins every number. The board's UI follows once its week-8 and week-9 page specs exist.
// Design and reasoning: decision 0021.
//
// The loss is L(w) = ½ Σ hᵢ (wᵢ − cᵢ)²: center c (the best fit with no penalty) and curvature h, how sharply the loss
// curves along each weight. A diagonal curvature is the decorrelated-features case of Goodfellow, Bengio and Courville,
// Deep learning (2016), §7.1, where the penalized weights have closed forms:
// - ridge and weight decay minimize L(w) + (α ÷ 2)‖w‖₂², so wᵢ = hᵢ cᵢ ÷ (hᵢ + α) (eq. 7.13);
// - lasso minimizes L(w) + α‖w‖₁, so wᵢ = sign(cᵢ) max(|cᵢ| − α ÷ hᵢ, 0) (eq. 7.23).
// Other libraries scale α differently (scikit-learn's Lasso divides the loss by the sample count), so a page says
// which form the board uses.
//
// The Lagrange multiplier follows the additive form L + λ g with g(w) = w₁ + w₂ − k (Goodfellow §4.4): at the best
// point on the path, −∇L = λ ∇g, so with the path's normal (1, 1), λ = 2 on the `touch` loss. With L − λ g it is −2.
import {
	absoluteFraction,
	addFractions,
	compareFractions,
	divideFractions,
	fraction,
	fractionSign,
	maxFraction,
	multiplyFractions,
	squareRoot,
	subtractFractions,
	toNumber,
	type Fraction,
} from '../boardMath.ts';
import { VIEW_LIMIT } from '../vectorBoard/model.ts';
import { normParts, type ExactPoint } from '../vectorBoard/norms.ts';

export type Weights = ExactPoint;

export interface Loss {
	/** The best fit with no penalty: the loss's lowest point. */
	center: Weights;
	/** How sharply the loss curves along w₁ and along w₂ (the diagonal of its Hessian). Both positive. */
	curvature: readonly [Fraction, Fraction];
}

const whole = (n: number) => fraction(n, 1);
const ZERO = whole(0);
const HALF = fraction(1, 2);
const pair = (first: Fraction, second: Fraction): Weights => [first, second];
const each = (loss: Loss, f: (center: Fraction, curvature: Fraction) => Fraction): Weights => pair(f(loss.center[0], loss.curvature[0]), f(loss.center[1], loss.curvature[1]));

/** ½ Σ hᵢ (wᵢ − cᵢ)². */
export function lossAt(loss: Loss, w: Weights): Fraction {
	const terms = [0, 1].map((i) => {
		const gap = subtractFractions(w[i], loss.center[i]);
		return multiplyFractions(loss.curvature[i], multiplyFractions(gap, gap));
	});
	return multiplyFractions(HALF, addFractions(terms[0], terms[1]));
}

/** ∇L = (hᵢ (wᵢ − cᵢ)). */
export function gradientAt(loss: Loss, w: Weights): Weights {
	return pair(multiplyFractions(loss.curvature[0], subtractFractions(w[0], loss.center[0])), multiplyFractions(loss.curvature[1], subtractFractions(w[1], loss.center[1])));
}

/** The downhill arrow −∇L. */
export function downhillAt(loss: Loss, w: Weights): Weights {
	const gradient = gradientAt(loss, w);
	return pair(multiplyFractions(whole(-1), gradient[0]), multiplyFractions(whole(-1), gradient[1]));
}

function requirePenalty(alpha: Fraction): void {
	if (alpha.numerator < 0) throw new Error(`NormBall: the penalty α must be at least 0, got ${alpha.numerator}/${alpha.denominator}.`);
}

/** Ridge (and weight decay): wᵢ = hᵢ cᵢ ÷ (hᵢ + α). */
export function ridge(loss: Loss, alpha: Fraction): Weights {
	requirePenalty(alpha);
	return each(loss, (center, curvature) => divideFractions(multiplyFractions(curvature, center), addFractions(curvature, alpha)));
}

/** The share of its size each weight keeps under ridge: hᵢ ÷ (hᵢ + α). */
export function keepShare(loss: Loss, alpha: Fraction): Weights {
	requirePenalty(alpha);
	return each(loss, (_center, curvature) => divideFractions(curvature, addFractions(curvature, alpha)));
}

/** Lasso: wᵢ = sign(cᵢ) max(|cᵢ| − α ÷ hᵢ, 0), soft-thresholding each weight's size by α ÷ hᵢ. */
export function lasso(loss: Loss, alpha: Fraction): Weights {
	requirePenalty(alpha);
	return each(loss, (center, curvature) => {
		const size = maxFraction(subtractFractions(absoluteFraction(center), divideFractions(alpha, curvature)), ZERO);
		return multiplyFractions(whole(fractionSign(center)), size);
	});
}

/**
 * The fence through w: ‖w‖₁ exactly, or ‖w‖₂ kept squared with its square root, exact when the squared size is the
 * square of a fraction (169/225 at α = 4 gives 13/15) and a float to round otherwise (29/25 gives √29 ÷ 5 ≈ 1.08).
 */
export function fenceSize(w: Weights, measure: 'l1' | 'l2'): { measure: 'l1'; size: Fraction } | { measure: 'l2'; squared: Fraction; root: ReturnType<typeof squareRoot> } {
	const parts = normParts(w);
	if (measure === 'l1') return { measure, size: parts.l1 };
	return { measure, squared: parts.l2Squared, root: squareRoot(parts.l2Squared) };
}

/** The contour at `level` is an ellipse with semi-axes √(2 level ÷ hᵢ). Floats, for drawing only. */
export function contourRadii(loss: Loss, level: Fraction): readonly [number, number] {
	if (level.numerator < 0) throw new Error('NormBall: a loss level is at least 0.');
	const radius = (curvature: Fraction) => Math.sqrt((2 * toNumber(level)) / toNumber(curvature));
	return [radius(loss.curvature[0]), radius(loss.curvature[1])];
}

/** Exact: the cross product is 0. */
export function isParallel(u: Weights, v: Weights): boolean {
	return compareFractions(multiplyFractions(u[0], v[1]), multiplyFractions(u[1], v[0])) === 0;
}

// ---- The losses and penalties the setups use (PROVISIONAL until the week-8 and week-9 page specs exist) ----

/** `fence` and `decay`: best fit (4, 1); the loss curves twice as sharply along w₂ as along w₁. */
export const FENCE_LOSS: Loss = { center: pair(whole(4), whole(1)), curvature: pair(whole(1), whole(2)) };
/** `touch`: lowest point (4, 2), off the path; the same curvature. */
export const TOUCH_LOSS: Loss = { center: pair(whole(4), whole(2)), curvature: pair(whole(1), whole(2)) };

/** α moves from 0 to 6 in steps of 0.5, so every penalized weight is a fraction. */
export const ALPHA_GRID = { min: whole(0), max: whole(6), step: HALF } as const;

/** Every α on the grid, from 0 up. */
export function alphaGrid(): readonly Fraction[] {
	const count = toNumber(divideFractions(subtractFractions(ALPHA_GRID.max, ALPHA_GRID.min), ALPHA_GRID.step));
	return Array.from({ length: count + 1 }, (_, i) => addFractions(ALPHA_GRID.min, multiplyFractions(whole(i), ALPHA_GRID.step)));
}

export function isOnAlphaGrid(alpha: Fraction): boolean {
	const steps = divideFractions(subtractFractions(alpha, ALPHA_GRID.min), ALPHA_GRID.step);
	return steps.denominator === 1 && compareFractions(alpha, ALPHA_GRID.min) >= 0 && compareFractions(alpha, ALPHA_GRID.max) <= 0;
}

/** Muted rings drawn before Check, at these loss levels. None is a solution's level (11/2, 243/50, 3). */
export const FENCE_RINGS: readonly Fraction[] = [whole(1), whole(2), whole(4)];
/** On `touch` the 4.5 ring would cross the path at (1, 2) and the corner (3, 0), giving away their midpoint. */
export const TOUCH_RINGS: readonly Fraction[] = [whole(1), whole(2), whole(8)];

// ---- The `touch` path: the north-east side of the diamond ‖w‖₁ = 3, w₁ + w₂ = 3 with both at least 0 ----

/** w₁ + w₂ = PATH_SUM. */
export const PATH_SUM = 3;
/** The point moves in steps of 1 ÷ PATH_STEPS_PER_UNIT = 0.25. */
export const PATH_STEPS_PER_UNIT = 4;
/** The last step index: 12, at the east corner (3, 0). Index 0 is the north corner (0, 3). */
export const PATH_LAST_INDEX = PATH_SUM * PATH_STEPS_PER_UNIT;
/** The path's normal, ∇g for g(w) = w₁ + w₂ − 3. */
export const PATH_NORMAL: Weights = pair(whole(1), whole(1));

function requireIndex(index: number): void {
	if (!Number.isInteger(index) || index < 0 || index > PATH_LAST_INDEX) throw new Error(`NormBall: path index must be a whole number from 0 to ${PATH_LAST_INDEX}, got ${index}.`);
}

/** The point at a step index, built from the integer so no float reaches a Fraction: w₁ = index ÷ 4. */
export function pathPoint(index: number): Weights {
	requireIndex(index);
	const first = fraction(index, PATH_STEPS_PER_UNIT);
	return pair(first, subtractFractions(whole(PATH_SUM), first));
}

/** Every point on the path, from (0, 3) to (3, 0). */
export const pathPoints = (): readonly Weights[] => Array.from({ length: PATH_LAST_INDEX + 1 }, (_, index) => pathPoint(index));

/** One step east (toward (3, 0), +1) or north (toward (0, 3), −1), or null at the end of the path. */
export function nextOnPath(index: number, direction: 1 | -1): number | null {
	requireIndex(index);
	const next = index + direction;
	return next < 0 || next > PATH_LAST_INDEX ? null : next;
}

/** The nearest step index to a dragged point, projected onto the path: w₁ − w₂ fixes the place along it. */
export function nearestPathIndex(point: readonly [number, number]): number {
	const along = (point[0] - point[1] + PATH_SUM) / 2;
	return Math.min(PATH_LAST_INDEX, Math.max(0, Math.round(along * PATH_STEPS_PER_UNIT)));
}

export type SlideHint = 'toward-east-corner' | 'toward-north-corner' | 'flat';

/**
 * Which way along the path lowers the loss: the sign of ∇L · (1, −1), the loss's change per unit of w₁ along the
 * path (3w₁ − 6 on `touch`). Negative means sliding toward (3, 0) helps.
 */
export function slideHint(loss: Loss, index: number): SlideHint {
	const gradient = gradientAt(loss, pathPoint(index));
	const change = subtractFractions(gradient[0], gradient[1]);
	const sign = fractionSign(change);
	return sign < 0 ? 'toward-east-corner' : sign > 0 ? 'toward-north-corner' : 'flat';
}

/** λ where −∇L = λ (1, 1), or null where the downhill arrow isn't parallel to the normal. */
export function lagrangeMultiplier(loss: Loss, index: number): Fraction | null {
	const downhill = downhillAt(loss, pathPoint(index));
	return isParallel(downhill, PATH_NORMAL) ? divideFractions(downhill[0], PATH_NORMAL[0]) : null;
}

/** The smallest loss on the whole segment, at w₁ = (h₁c₁ + h₂(k − c₂)) ÷ (h₁ + h₂) clamped to [0, k]. */
export function lowestOnPath(loss: Loss): { at: Weights; loss: Fraction } {
	const [h1, h2] = loss.curvature;
	const [c1, c2] = loss.center;
	const k = whole(PATH_SUM);
	const vertex = divideFractions(addFractions(multiplyFractions(h1, c1), multiplyFractions(h2, subtractFractions(k, c2))), addFractions(h1, h2));
	const first = maxFraction(ZERO, compareFractions(vertex, k) > 0 ? k : vertex);
	const at = pair(first, subtractFractions(k, first));
	return { at, loss: lossAt(loss, at) };
}

/**
 * True when a ring at `level` meets the path segment at two points, or touches it at the lowest point: the loss along
 * the path is a parabola, so that is every level from the lowest to the lower of the two corner losses. Such a ring
 * would show the answer (the midpoint of its two crossings) before Check.
 */
export function ringGivesAway(loss: Loss, level: Fraction): boolean {
	const lowest = lowestOnPath(loss).loss;
	const ends = [lossAt(loss, pathPoint(0)), lossAt(loss, pathPoint(PATH_LAST_INDEX))];
	const lowerEnd = compareFractions(ends[0], ends[1]) <= 0 ? ends[0] : ends[1];
	return compareFractions(level, lowest) >= 0 && compareFractions(level, lowerEnd) <= 0;
}

// ---- Checks at import ----

const onView = (w: Weights) => w.every((value) => compareFractions(absoluteFraction(value), whole(VIEW_LIMIT)) <= 0);
const text = (w: Weights) => `(${w.map((value) => `${value.numerator}/${value.denominator}`).join(', ')})`;
const add = (u: Weights, v: Weights): Weights => pair(addFractions(u[0], v[0]), addFractions(u[1], v[1]));

function checkLoss(name: string, loss: Loss): void {
	if (!loss.curvature.every((value) => value.numerator > 0)) throw new Error(`NormBall: ${name} needs a positive curvature along both weights.`);
	if (!onView(loss.center)) throw new Error(`NormBall: ${name}'s center ${text(loss.center)} is off the board (±${VIEW_LIMIT}).`);
}

/** What validateModel checks: the two losses and the rings drawn on `touch`. */
export interface NormBallModel {
	fenceLoss: Loss;
	touchLoss: Loss;
	touchRings: readonly Fraction[];
}

export const NORM_BALL_MODEL: NormBallModel = { fenceLoss: FENCE_LOSS, touchLoss: TOUCH_LOSS, touchRings: TOUCH_RINGS };

/** Throws, naming the problem, if a loss, a ring or a penalized weight can't be drawn or would give the answer away. */
export function validateModel(model: NormBallModel = NORM_BALL_MODEL): void {
	const { fenceLoss, touchLoss, touchRings } = model;
	checkLoss('the fence loss', fenceLoss);
	checkLoss('the touch loss', touchLoss);
	for (const alpha of alphaGrid()) {
		for (const [method, weights] of [['lasso', lasso(fenceLoss, alpha)], ['ridge', ridge(fenceLoss, alpha)]] as const) {
			if (!onView(weights)) throw new Error(`NormBall: ${method} at α = ${toNumber(alpha)} gives ${text(weights)}, off the board.`);
		}
	}
	for (const level of touchRings) {
		if (ringGivesAway(touchLoss, level)) throw new Error(`NormBall: the touch ring at loss ${toNumber(level)} crosses the path twice or touches it, so it shows the answer.`);
	}
	const parallel = pathPoints().filter((_, index) => lagrangeMultiplier(touchLoss, index) !== null);
	if (parallel.length !== 1) throw new Error(`NormBall: the touch path must have exactly one point where the downhill arrow is parallel to the normal, found ${parallel.length}.`);
	pathPoints().forEach((point, index) => {
		for (const tip of [add(point, downhillAt(touchLoss, point)), add(point, PATH_NORMAL)]) {
			if (!onView(tip)) throw new Error(`NormBall: an arrow from path point ${index} ends at ${text(tip)}, off the board.`);
		}
	});
}

validateModel();
