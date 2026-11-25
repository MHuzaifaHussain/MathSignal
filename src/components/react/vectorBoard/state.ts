// VectorBoard2D's state and every transition, as a pure reducer. React only stores the result; the rules (what is
// locked before Check, how far each handle may go, what a preset or Check changes) are all here, so
// scripts/check-boards.mjs checks them. Design and reasoning: decision 0014.
import * as guided from '../guided/guided.ts';
import {
	VIEW_LIMIT,
	add,
	classifyCartPush,
	classifyScale,
	classifyTripGuess,
	dot,
	equals,
	inBox,
	intersectBoxes,
	shiftBox,
	snapInto,
	subtract,
	symmetricBox,
	withinView,
	type Box,
	type CartPush,
	type ScaleGuess,
	type TripGuess,
	type Vec2,
} from './model.ts';
import { cartSolution, getSetup, isOnScale, type Setup, type SetupId, type Stage } from './setups.ts';

/** The vectors a reader can step with − / +. */
export type VectorId = 'guess' | 'a' | 'b';
/** The Mafs handles. `sum` sits at a + b on the add setup; moving it changes b. */
export type HandleId = VectorId | 'sum';
export type Axis = 'x' | 'y';
export type Direction = 1 | -1;
export type Sign = 'positive' | 'zero' | 'negative';

/** Check's verdict, or `shown` when the reader gave up and pressed "Show the answer" (no "Yes" for that). */
export type Feedback =
	| { kind: 'trip'; result: TripGuess }
	| { kind: 'scale'; result: ScaleGuess }
	| { kind: 'cart'; result: CartPush }
	| { kind: 'sign'; guess: Sign; correct: boolean }
	| { kind: 'shown' };

/**
 * Why a press did nothing. `edge`: the thing would leave the board. `limit`: the setup keeps its entries smaller
 * than the board. `sum-edge`: a + b would leave the board. `locked`: a and b are the question until Check.
 */
export type Refusal =
	| { kind: 'locked' }
	| { kind: 'no-sign' }
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
	scalar: number;
	guess: Vec2;
	signGuess: Sign | null;
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
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'preset'; id: string }
	| { type: 'stage'; stage: Stage }
	| { type: 'scalar'; value: number }
	| { type: 'other-order'; on: boolean }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

export const AXES: readonly Axis[] = ['x', 'y'];
export const DIRECTIONS: readonly Direction[] = [-1, 1];
const AXIS_INDEX: Readonly<Record<Axis, 0 | 1>> = { x: 0, y: 1 };

export function setupOf(state: VectorState): Setup {
	return getSetup(state.setupId);
}

function openingPreset(setup: Setup): string | null {
	const { a, b, scalar } = setup.opening;
	return setup.presets.find((preset) => equals(preset.a, a) && equals(preset.b, b) && (preset.scalar ?? scalar) === scalar)?.id ?? null;
}

export function initialState(setupId: SetupId): VectorState {
	const setup = getSetup(setupId);
	return {
		setupId,
		a: setup.opening.a,
		b: setup.opening.b,
		scalar: setup.opening.scalar,
		guess: setup.opening.guess,
		signGuess: null,
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
	const kind = setupOf(state).kind;
	if (kind === 'add') return state.checked ? ['a', 'b'] : ['guess', 'a', 'b'];
	if (kind === 'align') return ['a', 'b'];
	return ['a'];
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
	const kind = setupOf(state).kind;
	if (kind === 'add') return state.checked ? HANDLE_LISTS.addChecked : HANDLE_LISTS.guessOnly;
	if (kind === 'align') return state.checked ? HANDLE_LISTS.both : HANDLE_LISTS.none;
	return HANDLE_LISTS.aOnly;
}

/** a and b are the question on the add and align setups, so they wait for Check. */
export function isLocked(state: VectorState, id: VectorId): boolean {
	const kind = setupOf(state).kind;
	if (id === 'guess') return kind !== 'add' || state.checked;
	return (kind === 'add' || kind === 'align') && !state.checked;
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
 * judge), so it is cleared. A change to a, b or c also leaves the preset and the before-and-after comparison; moving
 * the guess doesn't.
 */
function withValues(state: VectorState, values: Partial<Pick<VectorState, 'a' | 'b' | 'scalar' | 'guess'>>): VectorState {
	const leavesPreset = 'a' in values || 'b' in values || 'scalar' in values;
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
			if (state.signGuess === null) return { ...state, refusal: { kind: 'no-sign' } };
			const correct = state.signGuess === signOf(dot(state.a, state.b));
			return { ...state, ...guided.recordCheck(state, correct, 'once'), feedback: { kind: 'sign', guess: state.signGuess, correct }, refusal: null };
		}
	}
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
	if (setup.kind === 'add') return { ...withValues(state, { guess: add(state.a, state.b) }), ...shown };
	if (setup.kind === 'scale') return { ...withValues(state, { scalar: requireTarget(setup) }), ...shown };
	if (setup.kind === 'cart') {
		const solution = cartSolution(setup);
		if (!solution) throw new Error(`VectorBoard2D: setup "${setup.id}" has no answer to show.`);
		return { ...withValues(state, { a: solution }), ...shown };
	}
	return state;
}

function applyPreset(setup: Setup, state: VectorState, id: string): VectorState {
	if (!state.checked) return state;
	const preset = setup.presets.find((candidate) => candidate.id === id);
	if (!preset) return state;
	const before = setup.kind === 'align' && state.activePreset !== null && state.activePreset !== id ? { presetId: state.activePreset, a: state.a, b: state.b } : null;
	return { ...withValues(state, { a: preset.a, b: preset.b, scalar: preset.scalar ?? state.scalar }), activePreset: id, before };
}

function setScalar(setup: Setup, state: VectorState, value: number): VectorState {
	const range = setup.scaleRange;
	if (setup.kind !== 'scale' || !range) return state;
	if (value < range.min || value > range.max) throw new Error(`VectorBoard2D: c = ${value} is outside ${range.min < 0 ? '−' : ''}${Math.abs(range.min)} to ${range.max}.`);
	if (!isOnScale(range, value)) throw new Error(`VectorBoard2D: c = ${value} isn't a step of ${range.step}.`);
	return value === state.scalar ? state : withValues(state, { scalar: value });
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
		case 'check':
			return check(setup, state);
		case 'show-answer':
			return showAnswer(setup, state);
		case 'preset':
			return applyPreset(setup, state, action.id);
		case 'stage':
			return stageAllowed(state, action.stage) ? { ...state, stage: action.stage, refusal: null } : state;
		case 'scalar':
			return setScalar(setup, state, action.value);
		case 'other-order':
			return setup.kind === 'add' && state.checked ? { ...state, otherOrder: action.on, refusal: null } : state;
		case 'table':
			return { ...state, tableOpen: action.open };
		case 'reset':
			return initialState(state.setupId);
	}
}
