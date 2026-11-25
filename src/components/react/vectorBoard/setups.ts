// The board configurations pages pick with <VectorBoard2D setup="…" />. Each one fixes the opening vectors, how far
// each vector may go, the presets and the stages. validateSetup runs at import, so a setup the board can't draw or
// answer fails the build. Design and reasoning: decision 0014.
import { isPerfectSquare, toNumber } from '../boardMath.ts';
import { fractionText } from '../boardText.ts';
import { latticeOnBall, type Measure } from './norms.ts';
import {
	VIEW_LIMIT,
	add,
	classifyCartPush,
	combine,
	cross,
	equals,
	flagWeights,
	inBox,
	isZero,
	lengthSquared,
	lineMultiple,
	numberText,
	scale,
	shadowTip,
	symmetricBox,
	withinView,
	type Vec2,
} from './model.ts';

export type SetupId = 'trips-add' | 'trips-scale' | 'cart-push' | 'align' | 'span-reach' | 'span-shape' | 'city-walk';
/**
 * add: two trips and their sum. scale: c a. cart: a push and its part along a track. align: a · b and the angle.
 * combine: c a + d b onto a flag. span-choice: a one-shot guess of what every c a + d b can reach. norms: one pin
 * measured three ways (walk, bird, king), with the shape of every point one length from home (decision 0021).
 */
export type SetupKind = 'add' | 'scale' | 'cart' | 'align' | 'combine' | 'span-choice' | 'norms';
/**
 * Trips: steps east and north, in words. Arrows: numbered axes and coordinates. Lists: column vectors. On norms setups
 * the same two ids are labeled Blocks and Numbers (stageLabel in describe.ts), so the stage plumbing is unchanged.
 */
export type Stage = 'trips' | 'arrows' | 'lists';
/** Which ball a norms setup draws: one measure's shape, or all three at once. */
export type MeasureChoice = Measure | 'all';

/** On cart setups `a` is the push and `b` the track direction. */
export interface Preset {
	id: string;
	label: string;
	a: Vec2;
	b: Vec2;
	/** The weight c of a, on scale and combine setups. */
	scalar?: number;
	/** The weight d of b, on combine setups. */
	scalarD?: number;
	/** The shape shown, on norms setups. */
	measure?: MeasureChoice;
	/** The length r of the shape, on norms setups. */
	radius?: number;
}

export interface ScaleRange {
	min: number;
	max: number;
	step: number;
}

/** The cart goal: a push of length √targetLengthSquared with targetForward of it along the track. */
export interface CartGoal {
	targetLengthSquared: number;
	targetForward: number;
}

export interface Setup {
	id: SetupId;
	kind: SetupKind;
	/** Each component of a stays within ±limitA, and of b within ±limitB. */
	limitA: number;
	limitB: number;
	/**
	 * `scalarD` is the weight d of b. Only combine setups have a d, so it is optional here and checkCombine requires it
	 * there; initialState reads 0 for the other kinds, which never show or use it.
	 */
	opening: { a: Vec2; b: Vec2; scalar: number; scalarD?: number; guess: Vec2 };
	/** Shown only after Check. */
	presets: readonly Preset[];
	/** The stages the "Show as" choice offers, in order; empty when the setup has no choice. */
	stages: readonly Stage[];
	openingStage: Stage;
	/** Stages that would give the answer away, so they wait for Check. */
	waitsForCheck: readonly Stage[];
	/** The slider range: c on scale setups, and both c and d on combine setups. */
	scaleRange?: ScaleRange;
	/** The c that Check accepts on a scale setup. */
	targetScalar?: number;
	goal?: CartGoal;
	/** The flag c a + d b must land on, on combine setups. */
	target?: Vec2;
	/** The c and d that land on the flag with the opening a and b ("Show the answer" sets them). */
	targetWeights?: readonly [number, number];
	/** The "Length r" slider, on norms setups. */
	radiusRange?: ScaleRange;
	/** The ball the norms guess asks about. After Check the board opens on it. */
	guessBall?: { measure: Measure; radius: number };
}

export const MAX_PRESETS = 4;
const ORIGIN: Vec2 = [0, 0];

const SETUP_LIST: readonly Setup[] = [
	{
		id: 'trips-add',
		kind: 'add',
		limitA: VIEW_LIMIT,
		limitB: VIEW_LIMIT,
		opening: { a: [3, 2], b: [1, 3], scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'two-trips', label: 'Two trips', a: [3, 2], b: [1, 3] },
			{ id: 'there-and-back', label: 'There and back', a: [3, 2], b: [-3, -2] },
			{ id: 'same-direction', label: 'Same direction', a: [2, 1], b: [2, 1] },
			{ id: 'square-corner', label: 'Square corner', a: [3, 0], b: [0, 4] },
		],
		stages: ['trips', 'arrows', 'lists'],
		openingStage: 'trips',
		waitsForCheck: ['lists'],
	},
	{
		id: 'trips-scale',
		kind: 'scale',
		limitA: 2,
		limitB: 0,
		opening: { a: [2, 1], b: ORIGIN, scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'double', label: 'Double', a: [2, 1], b: ORIGIN, scalar: 2 },
			{ id: 'half', label: 'Half', a: [2, 1], b: ORIGIN, scalar: 0.5 },
			{ id: 'turn-around', label: 'Turn around', a: [2, 1], b: ORIGIN, scalar: -1 },
			{ id: 'zero', label: 'Zero', a: [2, 1], b: ORIGIN, scalar: 0 },
		],
		stages: ['arrows', 'lists'],
		openingStage: 'arrows',
		waitsForCheck: [],
		scaleRange: { min: -2, max: 2, step: 0.5 },
		targetScalar: -1,
	},
	{
		id: 'cart-push',
		kind: 'cart',
		limitA: VIEW_LIMIT,
		limitB: VIEW_LIMIT,
		opening: { a: [5, 0], b: [1, 0], scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'sideways', label: 'Sideways', a: [0, 5], b: [1, 0] },
			{ id: 'backward', label: 'Backward', a: [-3, 4], b: [1, 0] },
			{ id: 'longer-track', label: 'Longer track arrow', a: [3, 4], b: [2, 0] },
			{ id: 'tilted-track', label: 'Tilted track', a: [5, 0], b: [4, 3] },
		],
		stages: [],
		openingStage: 'arrows',
		waitsForCheck: [],
		goal: { targetLengthSquared: 25, targetForward: 3 },
	},
	{
		id: 'align',
		kind: 'align',
		limitA: VIEW_LIMIT,
		// b's entries stay within ±4, so its shadow along any a stays on the board (at most 4.83 from the center).
		limitB: 4,
		opening: { a: [4, 1], b: [-1, 3], scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'perpendicular', label: 'Perpendicular', a: [3, 1], b: [-1, 3] },
			{ id: 'opposite', label: 'Opposite', a: [2, 1], b: [-4, -2] },
			{ id: 'short-b', label: 'Short b', a: [3, 1], b: [1, 2] },
			{ id: 'long-b', label: 'Long b', a: [3, 1], b: [2, 4] },
		],
		stages: [],
		openingStage: 'arrows',
		waitsForCheck: [],
	},
	{
		id: 'span-reach',
		kind: 'combine',
		limitA: VIEW_LIMIT,
		limitB: VIEW_LIMIT,
		opening: { a: [2, 1], b: [1, 2], scalar: 1, scalarD: 1, guess: ORIGIN },
		presets: [
			{ id: 'east-north', label: 'East and north', a: [1, 0], b: [0, 1], scalar: 4, scalarD: 5 },
			{ id: 'weights-swapped', label: 'Weights swapped', a: [2, 1], b: [1, 2], scalar: 2, scalarD: 1 },
			{ id: 'step-back', label: 'A step back', a: [2, 1], b: [1, 2], scalar: -1, scalarD: 1 },
			{ id: 'same-line', label: 'Same line', a: [2, 1], b: [4, 2], scalar: 1, scalarD: 0.5 },
		],
		stages: ['arrows', 'lists'],
		openingStage: 'arrows',
		waitsForCheck: [],
		scaleRange: { min: -5, max: 5, step: 0.5 },
		target: [4, 5],
		targetWeights: [1, 2],
	},
	{
		id: 'span-shape',
		kind: 'span-choice',
		limitA: VIEW_LIMIT,
		limitB: VIEW_LIMIT,
		opening: { a: [2, 1], b: [-4, -2], scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'different-lines', label: 'Different lines', a: [2, 1], b: [1, 2] },
			{ id: 'nearly-lined-up', label: 'Nearly lined up', a: [4, 2], b: [3, 2] },
			{ id: 'one-zero', label: 'One zero vector', a: [3, 1], b: ORIGIN },
			{ id: 'both-zero', label: 'Both zero', a: ORIGIN, b: ORIGIN },
		],
		stages: [],
		openingStage: 'arrows',
		waitsForCheck: [],
	},
	// PROVISIONAL: the vector norms page spec doesn't exist yet. Re-pin this copy and these presets when it does.
	{
		id: 'city-walk',
		kind: 'norms',
		limitA: VIEW_LIMIT,
		limitB: 0,
		opening: { a: [3, 4], b: ORIGIN, scalar: 1, guess: ORIGIN },
		presets: [
			{ id: 'friends-house', label: "Friend's house", a: [3, 4], b: ORIGIN, measure: 'l2', radius: 5 },
			{ id: 'straight-street', label: 'Straight street', a: [4, 0], b: ORIGIN, measure: 'all', radius: 4 },
			{ id: 'diagonal', label: 'Diagonal', a: [2, 2], b: ORIGIN, measure: 'l1', radius: 4 },
			{ id: 'nested-shapes', label: 'Nested shapes', a: [3, 3], b: ORIGIN, measure: 'all', radius: 4 },
		],
		stages: ['trips', 'arrows'],
		openingStage: 'trips',
		waitsForCheck: ['arrows'],
		radiusRange: { min: 1, max: VIEW_LIMIT, step: 1 },
		guessBall: { measure: 'l1', radius: 4 },
	},
];

const pairText = (v: Vec2) => `(${numberText(v[0])}, ${numberText(v[1])})`;

function setupError(setup: Setup, detail: string): Error {
	return new Error(`VectorBoard2D: setup "${setup.id}" ${detail}`);
}

/** Whole numbers within ±limit. */
function checkVector(setup: Setup, what: string, v: Vec2, limit: number): void {
	if (!v.every(Number.isInteger)) throw setupError(setup, `${what} = ${pairText(v)} must have whole numbers.`);
	if (!inBox(v, symmetricBox(limit))) throw setupError(setup, `${what} = ${pairText(v)} is outside ±${limit}.`);
}

/** Opening and preset vectors, named for error messages. */
function namedPairs(setup: Setup): readonly { name: string; a: Vec2; b: Vec2; scalar: number; scalarD: number | undefined }[] {
	const { a, b, scalar, scalarD } = setup.opening;
	return [
		{ name: 'opening', a, b, scalar, scalarD },
		...setup.presets.map((preset) => ({ name: `preset "${preset.id}"`, a: preset.a, b: preset.b, scalar: preset.scalar ?? scalar, scalarD: preset.scalarD })),
	];
}

function checkShape(setup: Setup): void {
	if (setup.presets.length > MAX_PRESETS) throw setupError(setup, `has ${setup.presets.length} presets; the most is ${MAX_PRESETS}.`);
	if (setup.stages.length > 0 && !setup.stages.includes(setup.openingStage)) throw setupError(setup, `opens on stage "${setup.openingStage}", which it doesn't offer.`);
	if (setup.waitsForCheck.includes(setup.openingStage)) throw setupError(setup, `opens on stage "${setup.openingStage}", which waits for Check.`);
	if (setup.limitA > VIEW_LIMIT || setup.limitB > VIEW_LIMIT) throw setupError(setup, `has limits wider than the board (±${VIEW_LIMIT}).`);
	checkVector(setup, 'opening guess', setup.opening.guess, VIEW_LIMIT);
	for (const { name, a, b } of namedPairs(setup)) {
		checkVector(setup, `${name} a`, a, setup.limitA);
		checkVector(setup, `${name} b`, b, setup.limitB);
	}
}

function checkAdd(setup: Setup): void {
	for (const { name, a, b } of namedPairs(setup)) {
		const sum = add(a, b);
		if (!withinView(sum)) throw setupError(setup, `${name}: a + b = ${pairText(sum)} leaves the board (±${VIEW_LIMIT}).`);
	}
}

function checkScale(setup: Setup): void {
	const range = setup.scaleRange;
	if (!range || setup.targetScalar === undefined) throw setupError(setup, 'is a scale setup with no scale range or target c.');
	const largest = Math.max(Math.abs(range.min), Math.abs(range.max));
	if (setup.limitA * largest > VIEW_LIMIT) {
		throw setupError(setup, `c a can reach ${numberText(setup.limitA * largest)} = ${setup.limitA} × ${numberText(largest)}, off the board (±${VIEW_LIMIT}).`);
	}
	for (const { name, scalar } of [...namedPairs(setup), { name: 'target', scalar: setup.targetScalar }]) {
		if (!isOnScale(range, scalar)) throw setupError(setup, `${name} c = ${scalar} isn't on the slider (${range.min} to ${range.max} in steps of ${range.step}).`);
	}
}

export function isOnScale(range: ScaleRange, scalar: number): boolean {
	const steps = (scalar - range.min) / range.step;
	return scalar >= range.min && scalar <= range.max && Math.abs(steps - Math.round(steps)) < 1e-9;
}

/** The first whole-number push that meets the cart goal, searching from the top of the board down; null if none. */
export function cartSolution(setup: Setup): Vec2 | null {
	const goal = setup.goal;
	if (!goal) return null;
	for (let y = setup.limitA; y >= -setup.limitA; y--) {
		for (let x = -setup.limitA; x <= setup.limitA; x++) {
			if (classifyCartPush([x, y], setup.opening.b, goal.targetLengthSquared, goal.targetForward) === 'match') return [x, y];
		}
	}
	return null;
}

function checkCart(setup: Setup): void {
	if (!setup.goal) throw setupError(setup, 'is a cart setup with no goal.');
	if (!isPerfectSquare(setup.goal.targetLengthSquared)) throw setupError(setup, 'needs a goal length that is a whole number.');
	for (const { name, a, b } of namedPairs(setup)) {
		if (isZero(b)) throw setupError(setup, `${name} track is the zero vector, so it has no direction.`);
		if (!isPerfectSquare(lengthSquared(b))) throw setupError(setup, `${name}: the track length must be a whole number; ${pairText(b)} has length √${lengthSquared(b)}.`);
		const tip = shadowTip(b, a);
		if (tip && !withinView(tip)) throw setupError(setup, `${name}: the shadow of the push leaves the board.`);
	}
	if (!cartSolution(setup)) throw setupError(setup, 'has no whole-number push for its goal.');
}

/** The farthest any shadow of b along a reaches from the center, over every a and b the limits allow. */
function worstShadow(setup: Setup): number {
	let worst = 0;
	for (let ax = -setup.limitA; ax <= setup.limitA; ax++) {
		for (let ay = -setup.limitA; ay <= setup.limitA; ay++) {
			for (let bx = -setup.limitB; bx <= setup.limitB; bx++) {
				for (let by = -setup.limitB; by <= setup.limitB; by++) {
					const tip = shadowTip([ax, ay], [bx, by]);
					if (tip) worst = Math.max(worst, Math.abs(tip[0]), Math.abs(tip[1]));
				}
			}
		}
	}
	return worst;
}

function checkAlign(setup: Setup): void {
	if (isZero(setup.opening.a) || isZero(setup.opening.b)) throw setupError(setup, 'opening has a zero vector, so the opening question has no angle.');
	const worst = worstShadow(setup);
	if (worst > VIEW_LIMIT) throw setupError(setup, `the shadow of b can reach ${numberText(worst)}, off the board (±${VIEW_LIMIT}); keep b's entries smaller.`);
}

function checkFlag(setup: Setup, range: ScaleRange, target: Vec2, targetWeights: readonly [number, number]): void {
	const { a, b } = setup.opening;
	if (!target.every(Number.isInteger) || !withinView(target) || isZero(target)) throw setupError(setup, `flag ${pairText(target)} must be a whole-number point on the board, not the origin.`);
	// On the diagonal the flag with east and north swapped is the flag itself, so the "swapped" verdict would mean nothing.
	if (target[0] === target[1]) throw setupError(setup, `flag ${pairText(target)} is on the diagonal, so "east and north swapped" would be the flag itself.`);
	if (cross(a, b) === 0) throw setupError(setup, `opening a = ${pairText(a)} and b = ${pairText(b)} line up, so the flag has no single answer.`);
	const exact = flagWeights(target, a, b);
	if (!exact) throw setupError(setup, 'has no weights for its flag.');
	const [c, d] = exact.map(toNumber);
	if (!isOnScale(range, c) || !isOnScale(range, d)) {
		throw setupError(setup, `flag ${pairText(target)} needs c = ${fractionText(exact[0])} and d = ${fractionText(exact[1])}, which the slider can't set.`);
	}
	if (targetWeights[0] !== c || targetWeights[1] !== d) {
		const landed = combine(targetWeights[0], a, targetWeights[1], b);
		throw setupError(setup, `flag weights c = ${numberText(targetWeights[0])}, d = ${numberText(targetWeights[1])} give ${pairText(landed)}, not the flag ${pairText(target)}.`);
	}
}

function checkCombine(setup: Setup): void {
	const { scaleRange: range, target, targetWeights } = setup;
	if (!range || !target || !targetWeights || setup.opening.scalarD === undefined) throw setupError(setup, 'is a combine setup with no slider range, flag, flag weights or opening d.');
	checkFlag(setup, range, target, targetWeights);
	for (const { name, a, b, scalar, scalarD } of namedPairs(setup)) {
		if (scalarD === undefined) throw setupError(setup, `${name} has no d.`);
		for (const [weight, value] of [['c', scalar], ['d', scalarD]] as const) {
			if (!isOnScale(range, value)) throw setupError(setup, `${name} ${weight} = ${value} isn't on the slider (${range.min} to ${range.max} in steps of ${range.step}).`);
		}
		const scaled = scale(scalar, a);
		const sum = combine(scalar, a, scalarD, b);
		// The opening and the presets draw whole on the board; only the reader's own slider moves may leave it.
		if (!withinView(scaled) || !withinView(sum)) throw setupError(setup, `${name}: c a = ${pairText(scaled)} or c a + d b = ${pairText(sum)} leaves the board (±${VIEW_LIMIT}).`);
	}
	const { a, b, scalar, scalarD } = setup.opening;
	if (equals(combine(scalar, a, scalarD, b), target)) throw setupError(setup, 'opens on the flag, so there is nothing to find.');
}

/** The fewest whole-number corners the guessed ball must have, so the verdict's count is a real picture. */
const MIN_GUESS_CORNERS = 4;

function checkNorms(setup: Setup): void {
	const { radiusRange: range, guessBall } = setup;
	if (!range || !guessBall) throw setupError(setup, 'is a norms setup with no length slider or guessed ball.');
	if (setup.scaleRange || setup.target || setup.limitB !== 0) throw setupError(setup, 'is a norms setup with a weight slider, a flag or a second vector, which it never shows.');
	if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.step !== 1 || range.min < 1 || range.max > VIEW_LIMIT) {
		throw setupError(setup, `has a length slider from ${range.min} to ${range.max} in steps of ${range.step}; it must move in whole steps from 1 up to ${VIEW_LIMIT}.`);
	}
	// The verdicts are written for the walking diamond at an even length: its corner "r/2 east and r/2 north" is whole.
	if (guessBall.measure !== 'l1' || guessBall.radius % 2 !== 0 || !isOnScale(range, guessBall.radius)) {
		throw setupError(setup, `asks about the ${guessBall.measure} ball at length ${guessBall.radius}; the verdicts are written for the walking diamond at an even length on the slider.`);
	}
	const corners = latticeOnBall(guessBall.measure, guessBall.radius, VIEW_LIMIT).length;
	if (corners < MIN_GUESS_CORNERS) throw setupError(setup, `asks about a ball with ${corners} whole-number corners; it needs at least ${MIN_GUESS_CORNERS}.`);
	for (const preset of setup.presets) {
		if (preset.measure === undefined || preset.radius === undefined) throw setupError(setup, `preset "${preset.id}" has no shape or length.`);
		if (!isOnScale(range, preset.radius)) throw setupError(setup, `preset "${preset.id}" has length ${preset.radius}, which the slider can't set.`);
	}
}

function checkSpanChoice(setup: Setup): void {
	if (setup.scaleRange || setup.target || setup.stages.length > 0) throw setupError(setup, 'is a span choice with a slider, a flag or stages, which it never shows.');
	const { a, b } = setup.opening;
	const k = lineMultiple(a, b);
	// The verdicts are written for b = k a with k a whole number and |k| at least 2: lined up, with no zero vector.
	if (isZero(a) || !k || k.denominator !== 1 || Math.abs(k.numerator) < 2) {
		throw setupError(setup, `opening b = ${pairText(b)} must be a whole multiple of a = ${pairText(a)}, at least 2 times as long; the verdicts are written for that case only.`);
	}
}

/** Throws, naming the setup, if any part of it can't work. */
export function validateSetup(setup: Setup): Setup {
	checkShape(setup);
	// One case per kind, so a new kind can't skip its checks: the default fails the type check and the build.
	switch (setup.kind) {
		case 'add':
			checkAdd(setup);
			break;
		case 'scale':
			checkScale(setup);
			break;
		case 'cart':
			checkCart(setup);
			break;
		case 'align':
			checkAlign(setup);
			break;
		case 'combine':
			checkCombine(setup);
			break;
		case 'span-choice':
			checkSpanChoice(setup);
			break;
		case 'norms':
			checkNorms(setup);
			break;
		default: {
			const unknownKind: never = setup.kind;
			throw setupError(setup, `has kind "${String(unknownKind)}", which validateSetup doesn't check.`);
		}
	}
	return setup;
}

/** Every setup, validated once at import, so a bad one fails the build and renders don't repeat the work. */
export const SETUPS: Readonly<Record<SetupId, Setup>> = Object.freeze(
	Object.fromEntries(SETUP_LIST.map((setup) => [setup.id, validateSetup(setup)])) as Record<SetupId, Setup>,
);

export function getSetup(id: string): Setup {
	// Own keys only, so "toString" and friends count as unknown rather than reaching Object.prototype.
	if (!Object.hasOwn(SETUPS, id)) throw new Error(`VectorBoard2D: unknown setup "${id}". Known setups: ${Object.keys(SETUPS).join(', ')}.`);
	return SETUPS[id as SetupId];
}
