// FunctionCurve's state and every transition, as a pure reducer. React only stores the result; what is held back
// before Check, what a preset keeps and when the Slide picture gives way to Ruler are all here, so
// scripts/check-boards.mjs checks them. Design and reasoning: decision 0020.
import * as guided from '../guided/guided.ts';
import {
	ALL_H_INDICES,
	H_LADDER,
	LINE_SLOPES,
	OPENING_H_INDEX,
	OPENING_LINE_SLOPE,
	PRE_CHECK_H_INDICES,
	PRESETS,
	SLIDE_PRESET,
	SLIDE_X_INDICES,
	curveOf,
	getSetup,
	pointValue,
	viewOf,
	type Choice,
	type PresetId,
	type Setup,
	type SetupId,
	type Stage,
} from './setups.ts';
import { compareFractions, type Fraction } from '../boardMath.ts';
import type { ExactFunction } from './functions.ts';

/**
 * Why Slide just left the choice: another preset, or a seat outside the slide. It lasts until the interaction that
 * caused it has been announced (a point move that continues the same slider burst or drag keeps it), then the next
 * action clears it, so it is said once.
 */
export type Notice = 'slide-preset' | 'slide-range';

export interface CurveState extends guided.CheckProgress {
	setupId: SetupId;
	preset: PresetId;
	/** 2x as a signed integer. */
	xIndex: number;
	/** An index on the full 12-value ladder, before Check too, so Check never moves the ruler. */
	hIndex: number;
	/** Quarter steps (ruler-to-tangent only). */
	guessIndex: number;
	/** The one-shot answer (corner only). */
	choice: Choice | null;
	stage: Stage;
	/** "Lines under the corner", on Hinge and V after Check. */
	linesOn: boolean;
	/** An index on the current preset's line-slope ladder. */
	lineSlopeIndex: number;
	tableOpen: boolean;
	notice: Notice | null;
	/** A wrong Check's verdict is on show; any change of value clears it. */
	missShown: boolean;
	/** The reader pressed Check before choosing (corner). */
	refused: boolean;
	/** The answer came from "Show the answer", not from a pass. */
	answerShown: boolean;
}

export type SliderKey = 'guess' | 'h' | 'point' | 'line-slope';

export type Action =
	| { type: 'guess'; index: number }
	| { type: 'h'; index: number }
	/** `continues`: another move in the same slider burst or drag, which keeps a notice the burst raised. */
	| { type: 'point'; xIndex: number; continues?: boolean }
	| { type: 'choice'; choice: Choice }
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'preset'; id: PresetId }
	| { type: 'stage'; stage: Stage }
	| { type: 'lines'; on: boolean }
	| { type: 'line-slope'; index: number }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

export const setupOf = (state: CurveState): Setup => getSetup(state.setupId);
export const curveFor = (state: CurveState): ExactFunction => curveOf(state.preset);
export const covered = (state: CurveState): boolean => !state.checked;
export const pointOf = (state: CurveState): Fraction => pointValue(state.xIndex);
export const hOf = (state: CurveState): Fraction => H_LADDER[state.hIndex];

/** The ruler lengths the reader may pick now: the 6 long ones before Check, all 12 after. */
export const allowedHIndices = (state: CurveState): readonly number[] => (covered(state) ? PRE_CHECK_H_INDICES : ALL_H_INDICES);

export const lineSlopesOf = (preset: PresetId): readonly Fraction[] => LINE_SLOPES[preset] ?? [];
export const hasCornerLines = (preset: PresetId): boolean => lineSlopesOf(preset).length > 0;
export const lineSlopeOf = (state: CurveState): Fraction => {
	const slope = lineSlopesOf(state.preset)[state.lineSlopeIndex];
	if (!slope) throw new Error(`FunctionCurve: preset "${state.preset}" has no line slope ${state.lineSlopeIndex}`);
	return slope;
};

function openingLineSlopeIndex(preset: PresetId): number {
	const slopes = lineSlopesOf(preset);
	if (slopes.length === 0) return 0;
	const index = slopes.findIndex((slope) => compareFractions(slope, OPENING_LINE_SLOPE) === 0);
	if (index < 0) throw new Error(`FunctionCurve: preset "${preset}" has no line slope 0.5 to open on`);
	return index;
}

/** The Slide picture covers only the Bowl with x from 1 to 2. */
export function slideFits(preset: PresetId, xIndex: number): boolean {
	return preset === SLIDE_PRESET && xIndex >= SLIDE_X_INDICES[0] && xIndex <= SLIDE_X_INDICES[1];
}

/** A stage is offered when the setup has it, Check has uncovered it, and (for Slide) the picture fits. */
export function stageAllowed(state: CurveState, stage: Stage): boolean {
	const setup = setupOf(state);
	if (!setup.stages.includes(stage)) return false;
	if (!guided.stageAllowed(stage, { stages: true, waitsForCheck: setup.waitsForCheck, covered: covered(state) })) return false;
	return stage !== 'slide' || slideFits(state.preset, state.xIndex);
}

export function initialState(setupId: SetupId): CurveState {
	const setup = getSetup(setupId);
	const preset = PRESETS[setup.openingPreset];
	return {
		setupId,
		checked: false,
		failedChecks: 0,
		preset: preset.id,
		xIndex: preset.xIndex,
		hIndex: OPENING_H_INDEX,
		guessIndex: setup.guess?.openingIndex ?? 0,
		choice: null,
		stage: setup.openingStage,
		linesOn: false,
		lineSlopeIndex: openingLineSlopeIndex(preset.id),
		tableOpen: false,
		notice: null,
		missShown: false,
		refused: false,
		answerShown: false,
	};
}

/** After a change of preset or point: Slide gives way to Ruler, with a notice, when the picture no longer fits. */
function keepStageFitting(state: CurveState, why: Notice): CurveState {
	if (state.stage !== 'slide' || slideFits(state.preset, state.xIndex)) return state;
	return { ...state, stage: 'ruler', notice: why };
}

function assertIndex(what: string, index: number, low: number, high: number): void {
	if (!Number.isInteger(index) || index < low || index > high) throw new Error(`FunctionCurve: ${what} ${index} is outside ${low} to ${high}`);
}

function check(state: CurveState): CurveState {
	const setup = setupOf(state);
	if (setup.guess) {
		const passed = state.guessIndex === setup.guess.answerIndex;
		return { ...state, ...guided.recordCheck(state, passed, setup.checkMode), missShown: !passed };
	}
	if (state.choice === null) return { ...state, refused: true };
	return { ...state, ...guided.recordCheck(state, state.choice === setup.answerChoice, setup.checkMode), refused: false };
}

function choosePreset(state: CurveState, id: PresetId): CurveState {
	if (!setupOf(state).presets.includes(id)) throw new Error(`FunctionCurve: setup "${state.setupId}" has no preset "${id}"`);
	const preset = PRESETS[id];
	const moved = {
		...state,
		preset: id,
		xIndex: preset.xIndex,
		linesOn: state.linesOn && hasCornerLines(id),
		lineSlopeIndex: openingLineSlopeIndex(id),
	};
	return keepStageFitting(moved, 'slide-preset');
}

/** Every value change clears a stale miss. */
function step(state: CurveState, action: Action): CurveState {
	const setup = setupOf(state);
	switch (action.type) {
		case 'guess': {
			if (!setup.guess || state.checked) return state;
			assertIndex('guess index', action.index, 0, setup.guess.maxIndex);
			return { ...state, guessIndex: action.index, missShown: false };
		}
		case 'h': {
			assertIndex('h index', action.index, 0, H_LADDER.length - 1);
			if (!allowedHIndices(state).includes(action.index)) return state;
			return { ...state, hIndex: action.index, missShown: false };
		}
		case 'point': {
			if (covered(state)) return state;
			const [low, high] = viewOf(state.preset).xIndexRange;
			assertIndex('point index', action.xIndex, low, high);
			return keepStageFitting({ ...state, xIndex: action.xIndex, missShown: false }, 'slide-range');
		}
		case 'choice':
			if (!setup.choices || state.checked) return state;
			return { ...state, choice: action.choice, refused: false };
		case 'check':
			return state.checked ? state : check(state);
		case 'show-answer':
			if (!setup.guess || !guided.canShowAnswer(state)) return state;
			return { ...state, guessIndex: setup.guess.answerIndex, checked: true, answerShown: true, missShown: false };
		case 'preset':
			return covered(state) ? state : choosePreset(state, action.id);
		case 'stage':
			return stageAllowed(state, action.stage) ? { ...state, stage: action.stage } : state;
		case 'lines':
			if (covered(state) || !hasCornerLines(state.preset)) return state;
			return { ...state, linesOn: action.on };
		case 'line-slope':
			if (covered(state) || !state.linesOn) return state;
			assertIndex('line slope index', action.index, 0, lineSlopesOf(state.preset).length - 1);
			return { ...state, lineSlopeIndex: action.index };
		case 'table':
			return { ...state, tableOpen: action.open };
		case 'reset':
			return initialState(state.setupId);
	}
}

/** Every action but a continuing point move clears the notice; the action itself may raise a new one. */
const keepsNotice = (action: Action): boolean => action.type === 'point' && action.continues === true;

export function reducer(state: CurveState, action: Action): CurveState {
	const next = step(keepsNotice(action) ? state : { ...state, notice: null }, action);
	// An action that changes nothing returns the same object, so React skips the render.
	return sameState(next, state) ? state : next;
}

function sameState(a: CurveState, b: CurveState): boolean {
	return (Object.keys(a) as (keyof CurveState)[]).every((key) => a[key] === b[key]);
}

/**
 * The preset the board shows now, drawn pressed: one of the setup's presets with the same curve and point, or null
 * once the reader has moved the point away from every preset.
 */
export function activePresetOf(state: CurveState): PresetId | null {
	const curve = PRESETS[state.preset].curve;
	return setupOf(state).presets.find((id) => PRESETS[id].curve === curve && PRESETS[id].xIndex === state.xIndex) ?? null;
}

/** Where the h slider sits: its position among the allowed rulers. */
export const hPosition = (state: CurveState): number => allowedHIndices(state).indexOf(state.hIndex);
