// VectorBoard2D's state and every transition, as a pure reducer. React only stores the result; the rules (what is
// locked before Check, how far each handle may go, what a preset or Check changes) are all here, so
// scripts/check-boards.mjs checks them. Design and reasoning: decision 0014.
import * as guided from '../guided/guided.ts';
import {
	VIEW_LIMIT,
	add,
	classifyCartPush,
	classifyCombine,
	classifyScale,
	classifyTripGuess,
	dot,
	equals,
	inBox,
	intersectBoxes,
	shiftBox,
	snapInto,
	spanKind,
	subtract,
	symmetricBox,
	withinView,
	type Box,
	type CartPush,
	type CombineGuess,
	type ScaleGuess,
	type SpanKind,
	type TripGuess,
	type Vec2,
} from './model.ts';
import { cartSolution, getSetup, isOnScale, type MeasureChoice, type Setup, type SetupId, type Stage } from './setups.ts';

/** The vectors a reader can step with − / +. */
export type VectorId = 'guess' | 'a' | 'b';
/** The Mafs handles. `sum` sits at a + b on the add setup; moving it changes b. */
export type HandleId = VectorId | 'sum';
export type Axis = 'x' | 'y';
export type Direction = 1 | -1;
export type Sign = 'positive' | 'zero' | 'negative';
/** The two weights a slider sets: c scales a, and d scales b on the combine setup. */
export type Weight = 'c' | 'd';
/** The norms guess: the shape every corner one walking length from home makes. */
export type ShapeGuess = 'diamond' | 'circle' | 'square';

/** Check's verdict, or `shown` when the reader gave up and pressed "Show the answer" (no "Yes" for that). */
export type Feedback =
	| { kind: 'trip'; result: TripGuess }
	| { kind: 'scale'; result: ScaleGuess }
	| { kind: 'cart'; result: CartPush }
	| { kind: 'sign'; guess: Sign; correct: boolean }
	| { kind: 'combine'; result: CombineGuess }
	| { kind: 'span'; guess: SpanKind; correct: boolean }
	| { kind: 'shape'; guess: ShapeGuess; correct: boolean }
	| { kind: 'shown' };

/**
 * Why a press did nothing. `edge`: the thing would leave the board. `limit`: the setup keeps its entries smaller
 * than the board. `sum-edge`: a + b would leave the board. `locked`: a and b are the question until Check.
 * `no-guess`: Check needs a guess picked first (the sign on align, the span on span-choice, the shape on norms).
 */
export type Refusal =
	| { kind: 'locked' }
	| { kind: 'no-guess' }
	| { kind: 'edge' | 'limit' | 'sum-edge'; id: HandleId; axis: Axis; direction: Direction };

/** The previous preset on the align setup, so the board can compare a · b before and after. */
export interface Before {
	presetId: string;
	a: Vec2;
	b: Vec2;
}

export interface VectorState extends guided.CheckProgress {
	setupId: SetupId;
	/** On cart setups a is the push and b the track direction. */
	a: Vec2;
	b: Vec2;
	/** The weight c of a (the scale setup's c). */
	scalar: number;
	/** The weight d of b, on combine setups. */
	scalarD: number;
	guess: Vec2;
	signGuess: Sign | null;
	spanGuess: SpanKind | null;
	shapeGuess: ShapeGuess | null;
	/** The shape drawn after Check on norms setups, and its length r. Other kinds never read them. */
	measure: MeasureChoice;
	radius: number;
	feedback: Feedback | null;
	stage: Stage;
	/** The preset the values came from, or null once the reader has moved away from it. */
	activePreset: string | null;
	before: Before | null;
	/** "Show b first too" on the add setup. */
	otherOrder: boolean;
	refusal: Refusal | null;
	/** "Table view": the coordinate table open under the switch. Off at the start and after Reset (decision 0017). */
	tableOpen: boolean;
}

export type Action =
	| { type: 'move'; id: HandleId; to: Vec2 }
	| { type: 'step'; id: VectorId; axis: Axis; direction: Direction }
	| { type: 'sign'; sign: Sign }
	| { type: 'span-guess'; guess: SpanKind }
	| { type: 'shape-guess'; guess: ShapeGuess }
	| { type: 'measure'; measure: MeasureChoice }
	| { type: 'radius'; value: number }
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'preset'; id: string }
	| { type: 'stage'; stage: Stage }
	| { type: 'scalar'; weight: Weight; value: number }
	| { type: 'other-order'; on: boolean }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

export const AXES: readonly Axis[] = ['x', 'y'];
export const DIRECTIONS: readonly Direction[] = [-1, 1];
const AXIS_INDEX: Readonly<Record<Axis, 0 | 1>> = { x: 0, y: 1 };

export function setupOf(state: VectorState): Setup {
	return getSetup(state.setupId);
}

/** The opening's d: only combine setups have one (validateSetup requires it there). */
const openingD = (setup: Setup) => setup.opening.scalarD ?? 0;

/** The ball a norms setup opens on after Check: the one its guess asks about. Other kinds read l1 at 0 and never use it. */
const openingBall = (setup: Setup) => setup.guessBall ?? { measure: 'l1' as const, radius: 0 };

function openingPreset(setup: Setup): string | null {
	// A norms preset also sets the shape and length, which the opening never shows before Check.
	if (setup.kind === 'norms') return null;
	const { a, b, scalar } = setup.opening;
	const d = openingD(setup);
	return setup.presets.find((preset) => equals(preset.a, a) && equals(preset.b, b) && (preset.scalar ?? scalar) === scalar && (preset.scalarD ?? d) === d)?.id ?? null;
}

export function initialState(setupId: SetupId): VectorState {
	const setup = getSetup(setupId);
	return {
		setupId,
		a: setup.opening.a,
		b: setup.opening.b,
		scalar: setup.opening.scalar,
		scalarD: openingD(setup),
		guess: setup.opening.guess,
		signGuess: null,
		spanGuess: null,
		shapeGuess: null,
		measure: openingBall(setup).measure,
		radius: openingBall(setup).radius,
		checked: false,
		failedChecks: 0,
		feedback: null,
		stage: setup.openingStage,
		activePreset: openingPreset(setup),
		before: null,
		otherOrder: false,
		refusal: null,
		tableOpen: false,
	};
}

/** Every setup holds its answer back until Check. */
export function isCovered(state: VectorState): boolean {
	return !state.checked;
}

export function stageAllowed(state: VectorState, stage: Stage): boolean {
	const setup = setupOf(state);
	return setup.stages.includes(stage) && guided.stageAllowed(stage, { stages: setup.stages.length > 0, waitsForCheck: setup.waitsForCheck, covered: isCovered(state) });
}

/** The vectors with − / + steppers right now, in table order. */
export function steppableVectors(state: VectorState): readonly VectorId[] {
	switch (setupOf(state).kind) {
		case 'add':
			return state.checked ? ['a', 'b'] : ['guess', 'a', 'b'];
		case 'align':
		case 'combine':
		case 'span-choice':
			return ['a', 'b'];
		case 'scale':
		case 'cart':
		case 'norms':
			return ['a'];
	}
}

/** Shared, frozen lists, so the same handles keep the same array and the plane's handlers survive a move. */
const HANDLE_LISTS = {
	guessOnly: Object.freeze(['guess']),
	addChecked: Object.freeze(['a', 'sum']),
	none: Object.freeze([]),
	both: Object.freeze(['a', 'b']),
	aOnly: Object.freeze(['a']),
} as const satisfies Record<string, readonly HandleId[]>;

/** The Mafs handles right now, in render order. Locked vectors get no handle at all, so a pointer can't drag them. */
export function handleIds(state: VectorState): readonly HandleId[] {
	switch (setupOf(state).kind) {
		case 'add':
			return state.checked ? HANDLE_LISTS.addChecked : HANDLE_LISTS.guessOnly;
		case 'align':
		case 'combine':
		case 'span-choice':
			return state.checked ? HANDLE_LISTS.both : HANDLE_LISTS.none;
		case 'scale':
		case 'cart':
		case 'norms':
			return HANDLE_LISTS.aOnly;
	}
}

/** a and b are the question on every setup except scale, cart and norms, so they wait for Check there. */
export function isLocked(state: VectorState, id: VectorId): boolean {
	const kind = setupOf(state).kind;
	if (id === 'guess') return kind !== 'add' || state.checked;
	switch (kind) {
		case 'add':
		case 'align':
		case 'combine':
		case 'span-choice':
			return !state.checked;
		case 'scale':
		case 'cart':
		case 'norms':
			return false;
	}
}

function ownLimit(setup: Setup, id: VectorId): number {
	if (id === 'guess') return VIEW_LIMIT;
	return id === 'a' ? setup.limitA : setup.limitB;
}

/** Where a vector may go: its own limits, and on the add setup wherever keeps a + b on the board. */
export function vectorBox(state: VectorState, id: VectorId): Box {
	const setup = setupOf(state);
	const own = symmetricBox(ownLimit(setup, id));
	if (setup.kind !== 'add' || id === 'guess') return own;
	const other = id === 'a' ? state.b : state.a;
	return intersectBoxes(own, shiftBox(symmetricBox(VIEW_LIMIT), [-other[0], -other[1]]));
}

/** Where a handle may go. The sum handle moves b, so its box is b's box carried to the tip of a. */
export function handleBox(state: VectorState, handle: HandleId): Box {
	return handle === 'sum' ? shiftBox(vectorBox(state, 'b'), state.a) : vectorBox(state, handle);
}

export function handlePoint(state: VectorState, handle: HandleId): Vec2 {
	if (handle === 'sum') return add(state.a, state.b);
	return handle === 'guess' ? state.guess : state[handle];
}

function nudge(point: Vec2, axis: Axis, direction: Direction): Vec2 {
	return axis === 'x' ? [point[0] + direction, point[1]] : [point[0], point[1] + direction];
}

/** Why a vector's − / + would be refused right now, or null if it would go through. */
export function stepRefusal(state: VectorState, id: VectorId, axis: Axis, direction: Direction): Refusal | null {
	if (isLocked(state, id)) return { kind: 'locked' };
	const next = nudge(state[id], axis, direction);
	if (inBox(next, vectorBox(state, id))) return null;
	const limit = ownLimit(setupOf(state), id);
	if (Math.abs(next[AXIS_INDEX[axis]]) > limit) return { kind: limit === VIEW_LIMIT ? 'edge' : 'limit', id, axis, direction };
	return { kind: 'sum-edge', id, axis, direction };
}

/** Every direction a handle can't move one step in, with the reason, for the end-of-interaction sentence. */
export function handleRefusals(state: VectorState, handle: HandleId): readonly Refusal[] {
	return AXES.flatMap((axis) =>
		DIRECTIONS.flatMap((direction): Refusal[] => {
			if (handle !== 'sum') {
				const refusal = stepRefusal(state, handle, axis, direction);
				return refusal && refusal.kind !== 'locked' ? [refusal] : [];
			}
			const next = nudge(handlePoint(state, 'sum'), axis, direction);
			if (inBox(next, handleBox(state, 'sum'))) return [];
			if (!withinView(next)) return [{ kind: 'edge', id: 'sum', axis, direction }];
			const refusal = stepRefusal(state, 'b', axis, direction);
			return refusal ? [refusal] : [];
		}),
	);
}

/**
 * Every value change goes through here. Stale feedback misleads (a "Yes" must never stand next to values it didn't
 * judge), so it is cleared. A change to a, b, c, d, the shape or its length also leaves the preset and the
 * before-and-after comparison; moving the guess doesn't.
 */
function withValues(state: VectorState, values: Partial<Pick<VectorState, 'a' | 'b' | 'scalar' | 'scalarD' | 'guess' | 'measure' | 'radius'>>): VectorState {
	const leavesPreset = 'a' in values || 'b' in values || 'scalar' in values || 'scalarD' in values || 'measure' in values || 'radius' in values;
	const preset = leavesPreset ? { activePreset: null, before: null } : {};
	return { ...state, ...values, feedback: null, refusal: null, ...preset };
}

function moveHandle(state: VectorState, handle: HandleId, to: Vec2): VectorState {
	if (!handleIds(state).includes(handle)) return state;
	const point = snapInto(to, handleBox(state, handle));
	if (equals(point, handlePoint(state, handle))) return state;
	if (handle === 'sum') return withValues(state, { b: subtract(point, state.a) });
	return withValues(state, { [handle]: point });
}

function step(state: VectorState, id: VectorId, axis: Axis, direction: Direction): VectorState {
	if (!steppableVectors(state).includes(id)) return state;
	const refusal = stepRefusal(state, id, axis, direction);
	if (refusal) return { ...state, refusal };
	return withValues(state, { [id]: nudge(state[id], axis, direction) });
}

export function signOf(value: number): Sign {
	if (value > 0) return 'positive';
	return value < 0 ? 'negative' : 'zero';
}

function check(setup: Setup, state: VectorState): VectorState {
	if (state.checked) return state;
	switch (setup.kind) {
		case 'add': {
			const result = classifyTripGuess(state.a, state.b, state.guess);
			return { ...state, ...guided.recordCheck(state, result === 'match', 'retry'), feedback: { kind: 'trip', result }, refusal: null };
		}
		case 'scale': {
			const result = classifyScale(state.scalar, requireTarget(setup));
			return { ...state, ...guided.recordCheck(state, result === 'match', 'retry'), feedback: { kind: 'scale', result }, refusal: null };
		}
		case 'cart': {
			const goal = requireGoal(setup);
			const result = classifyCartPush(state.a, state.b, goal.targetLengthSquared, goal.targetForward);
			return { ...state, ...guided.recordCheck(state, result === 'match', 'retry'), feedback: { kind: 'cart', result }, refusal: null };
		}
		case 'align': {
			if (state.signGuess === null) return { ...state, refusal: { kind: 'no-guess' } };
			const correct = state.signGuess === signOf(dot(state.a, state.b));
			return { ...state, ...guided.recordCheck(state, correct, 'once'), feedback: { kind: 'sign', guess: state.signGuess, correct }, refusal: null };
		}
		case 'combine': {
			const result = classifyCombine(state.a, state.b, state.scalar, state.scalarD, requireFlag(setup).target);
			return { ...state, ...guided.recordCheck(state, result === 'match', 'retry'), feedback: { kind: 'combine', result }, refusal: null };
		}
		case 'span-choice': {
			if (state.spanGuess === null) return { ...state, refusal: { kind: 'no-guess' } };
			const correct = state.spanGuess === spanKind(state.a, state.b);
			return { ...state, ...guided.recordCheck(state, correct, 'once'), feedback: { kind: 'span', guess: state.spanGuess, correct }, refusal: null };
		}
		case 'norms': {
			if (state.shapeGuess === null) return { ...state, refusal: { kind: 'no-guess' } };
			// The question is always the walking ball (validateSetup), whose shape is the diamond.
			const correct = state.shapeGuess === 'diamond';
			return { ...state, ...guided.recordCheck(state, correct, 'once'), feedback: { kind: 'shape', guess: state.shapeGuess, correct }, refusal: null };
		}
	}
}

/** The flag and the weights that reach it, on a combine setup. */
export function requireFlag(setup: Setup): { target: Vec2; weights: readonly [number, number] } {
	if (!setup.target || !setup.targetWeights) throw new Error(`VectorBoard2D: setup "${setup.id}" has no flag.`);
	return { target: setup.target, weights: setup.targetWeights };
}

function requireTarget(setup: Setup): number {
	if (setup.targetScalar === undefined) throw new Error(`VectorBoard2D: setup "${setup.id}" has no target c.`);
	return setup.targetScalar;
}

function requireGoal(setup: Setup) {
	if (!setup.goal) throw new Error(`VectorBoard2D: setup "${setup.id}" has no cart goal.`);
	return setup.goal;
}

/** The answer, put on the board. One-shot setups never offer it, because any answer already reveals. */
function showAnswer(setup: Setup, state: VectorState): VectorState {
	if (!guided.canShowAnswer(state)) return state;
	const shown = { checked: true, feedback: { kind: 'shown' } as const };
	switch (setup.kind) {
		case 'add':
			return { ...withValues(state, { guess: add(state.a, state.b) }), ...shown };
		case 'scale':
			return { ...withValues(state, { scalar: requireTarget(setup) }), ...shown };
		case 'cart': {
			const solution = cartSolution(setup);
			if (!solution) throw new Error(`VectorBoard2D: setup "${setup.id}" has no answer to show.`);
			return { ...withValues(state, { a: solution }), ...shown };
		}
		case 'combine': {
			const [c, d] = requireFlag(setup).weights;
			return { ...withValues(state, { scalar: c, scalarD: d }), ...shown };
		}
		case 'align':
		case 'span-choice':
		case 'norms':
			return state;
	}
}

function applyPreset(setup: Setup, state: VectorState, id: string): VectorState {
	if (!state.checked) return state;
	const preset = setup.presets.find((candidate) => candidate.id === id);
	if (!preset) return state;
	const before = setup.kind === 'align' && state.activePreset !== null && state.activePreset !== id ? { presetId: state.activePreset, a: state.a, b: state.b } : null;
	const values = {
		a: preset.a,
		b: preset.b,
		scalar: preset.scalar ?? state.scalar,
		scalarD: preset.scalarD ?? state.scalarD,
		measure: preset.measure ?? state.measure,
		radius: preset.radius ?? state.radius,
	};
	return { ...withValues(state, values), activePreset: id, before };
}

const WEIGHT_LISTS = {
	none: Object.freeze([]),
	c: Object.freeze(['c']),
	both: Object.freeze(['c', 'd']),
} as const satisfies Record<string, readonly Weight[]>;

/** The weights the tray has a slider for, in tray order: c on scale, c and d on combine, none elsewhere. */
export function sliderWeights(setup: Setup): readonly Weight[] {
	switch (setup.kind) {
		case 'scale':
			return WEIGHT_LISTS.c;
		case 'combine':
			return WEIGHT_LISTS.both;
		case 'add':
		case 'cart':
		case 'align':
		case 'span-choice':
		case 'norms':
			return WEIGHT_LISTS.none;
	}
}

/** The current value of a weight: c is `scalar`, d is `scalarD`. */
export const weightValue = (state: VectorState, weight: Weight) => (weight === 'c' ? state.scalar : state.scalarD);

function setScalar(setup: Setup, state: VectorState, weight: Weight, value: number): VectorState {
	const range = setup.scaleRange;
	if (!range || !sliderWeights(setup).includes(weight)) return state;
	if (value < range.min || value > range.max) throw new Error(`VectorBoard2D: ${weight} = ${value} is outside ${range.min < 0 ? '−' : ''}${Math.abs(range.min)} to ${range.max}.`);
	if (!isOnScale(range, value)) throw new Error(`VectorBoard2D: ${weight} = ${value} isn't a step of ${range.step}.`);
	if (value === weightValue(state, weight)) return state;
	return withValues(state, weight === 'c' ? { scalar: value } : { scalarD: value });
}

/** The shape and its length wait for Check: before it they are the answer. */
function setMeasure(setup: Setup, state: VectorState, measure: MeasureChoice): VectorState {
	if (setup.kind !== 'norms' || !state.checked || measure === state.measure) return state;
	return withValues(state, { measure });
}

function setRadius(setup: Setup, state: VectorState, value: number): VectorState {
	const range = setup.radiusRange;
	if (setup.kind !== 'norms' || !range || !state.checked) return state;
	if (!isOnScale(range, value)) throw new Error(`VectorBoard2D: length r = ${value} isn't on the slider (${range.min} to ${range.max} in steps of ${range.step}).`);
	return value === state.radius ? state : withValues(state, { radius: value });
}

export function reducer(state: VectorState, action: Action): VectorState {
	const setup = setupOf(state);
	switch (action.type) {
		case 'move':
			return moveHandle(state, action.id, action.to);
		case 'step':
			return step(state, action.id, action.axis, action.direction);
		case 'sign':
			if (setup.kind !== 'align' || state.checked) return state;
			return { ...state, signGuess: action.sign, refusal: null };
		case 'span-guess':
			if (setup.kind !== 'span-choice' || state.checked) return state;
			return { ...state, spanGuess: action.guess, refusal: null };
		case 'shape-guess':
			if (setup.kind !== 'norms' || state.checked) return state;
			return { ...state, shapeGuess: action.guess, refusal: null };
		case 'measure':
			return setMeasure(setup, state, action.measure);
		case 'radius':
			return setRadius(setup, state, action.value);
		case 'check':
			return check(setup, state);
		case 'show-answer':
			return showAnswer(setup, state);
		case 'preset':
			return applyPreset(setup, state, action.id);
		case 'stage':
			return stageAllowed(state, action.stage) ? { ...state, stage: action.stage, refusal: null } : state;
		case 'scalar':
			return setScalar(setup, state, action.weight, action.value);
		case 'other-order':
			return setup.kind === 'add' && state.checked ? { ...state, otherOrder: action.on, refusal: null } : state;
		case 'table':
			return { ...state, tableOpen: action.open };
		case 'reset':
			return initialState(state.setupId);
	}
}
