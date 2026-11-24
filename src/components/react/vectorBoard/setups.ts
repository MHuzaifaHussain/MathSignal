// The board configurations pages pick with <VectorBoard2D setup="…" />. Each one fixes the opening vectors, how far
// each vector may go, the presets and the stages. validateSetup runs at import, so a setup the board can't draw or
// answer fails the build. Design and reasoning: decision 0014.
import {
	VIEW_LIMIT,
	add,
	classifyCartPush,
	inBox,
	isPerfectSquare,
	isZero,
	lengthSquared,
	numberText,
	shadowTip,
	symmetricBox,
	withinView,
	type Vec2,
} from './model.ts';

export type SetupId = 'trips-add' | 'trips-scale' | 'cart-push' | 'align';
/** add: two trips and their sum. scale: c a. cart: a push and its part along a track. align: a · b and the angle. */
export type SetupKind = 'add' | 'scale' | 'cart' | 'align';
/** Trips: steps east and north, in words. Arrows: numbered axes and coordinates. Lists: column vectors. */
export type Stage = 'trips' | 'arrows' | 'lists';

/** On cart setups `a` is the push and `b` the track direction. */
export interface Preset {
	id: string;
	label: string;
	a: Vec2;
	b: Vec2;
	/** The scale c, on scale setups. */
	scalar?: number;
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
	opening: { a: Vec2; b: Vec2; scalar: number; guess: Vec2 };
	/** Shown only after Check. */
	presets: readonly Preset[];
	/** The stages the "Show as" choice offers, in order; empty when the setup has no choice. */
	stages: readonly Stage[];
	openingStage: Stage;
	/** Stages that would give the answer away, so they wait for Check. */
	waitsForCheck: readonly Stage[];
	scaleRange?: ScaleRange;
	/** The c that Check accepts on a scale setup. */
	targetScalar?: number;
	goal?: CartGoal;
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
function namedPairs(setup: Setup): readonly { name: string; a: Vec2; b: Vec2; scalar: number }[] {
	return [
		{ name: 'opening', ...setup.opening },
		...setup.presets.map((preset) => ({ name: `preset "${preset.id}"`, a: preset.a, b: preset.b, scalar: preset.scalar ?? setup.opening.scalar })),
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

/** Throws, naming the setup, if any part of it can't work. */
export function validateSetup(setup: Setup): Setup {
	checkShape(setup);
	if (setup.kind === 'add') checkAdd(setup);
	if (setup.kind === 'scale') checkScale(setup);
	if (setup.kind === 'cart') checkCart(setup);
	if (setup.kind === 'align') checkAlign(setup);
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
