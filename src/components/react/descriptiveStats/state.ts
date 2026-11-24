// DescriptiveStats' state and every transition, as a pure reducer. React only stores the result; the rules (what
// stays covered before Check, which stages wait, what a preset keeps as a ghost) are all here, so
// scripts/check-boards.mjs checks them. Design and reasoning: decision 0015.
import * as guided from '../guided/guided.ts';
import { pumpkins } from './datasets.ts';
import { median, populationSD, rankOf, type Root } from './model.ts';
import { CUTOFFS, SCALES, getSetup, presetById, type Cutoff, type Preset, type Scale, type Setup, type SetupId, type Stage } from './setups.ts';

/** Check's verdict on the middle child, or `shown` when the reader pressed "Show the answer". */
export type Feedback = { kind: 'right'; child: number } | { kind: 'wrong'; child: number } | { kind: 'shown'; child: number };
/** Check pressed before a child was picked. */
export type Refusal = { kind: 'no-pick' };

export interface DescriptiveState extends guided.CheckProgress {
	setupId: SetupId;
	stage: Stage;
	/** The list in view: heights, savings without the newcomer, pumpkins, or test B's marks. */
	values: readonly number[];
	/** Line-up setups: whether the bars stand shortest to tallest. */
	linedUp: boolean;
	/** Line-up setups: the reader's middle child (an index into `values`), or null before a pick. */
	pick: number | null;
	feedback: Feedback | null;
	/** Spread setups: the child the Height slider moves. */
	selected: number;
	distances: boolean;
	/** Spread setups: also show the sample versions, x̄ and s (÷ n − 1). */
	sample: boolean;
	/** The previous preset's σ, drawn dashed so the reader can compare. */
	ghost: { sigma: Root; preset: string } | null;
	/** Newcomer setups: the newcomer's savings while they are in the cafe, or null. */
	newcomer: number | null;
	/** Newcomer setups: the slider's value, kept while the newcomer is away. */
	newcomerValue: number;
	scale: Scale;
	giant: number;
	giants: 1 | 2;
	cutoff: Cutoff;
	/** The preset the values came from, or null once the reader has stepped away from it. */
	activePreset: string | null;
	refusal: Refusal | null;
}

export type Action =
	| { type: 'line-up'; on: boolean }
	| { type: 'pick'; child: number }
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'select'; child: number }
	| { type: 'set-value'; value: number }
	| { type: 'preset'; id: string }
	| { type: 'stage'; stage: Stage }
	| { type: 'distances'; on: boolean }
	| { type: 'sample'; on: boolean }
	| { type: 'newcomer'; on: boolean }
	| { type: 'scale'; scale: Scale }
	| { type: 'cutoff'; cutoff: Cutoff }
	| { type: 'reset' };

export function setupOf(state: DescriptiveState): Setup {
	return getSetup(state.setupId);
}

/** The preset that matches the opening, so a ghost can name it; null when the opening isn't a preset. */
function openingPreset(setup: Setup): string | null {
	if (setup.kind === 'newcomer') return setup.presets.find((preset) => preset.newcomer === null)?.id ?? null;
	if (setup.kind === 'outliers') return setup.presets.find((preset) => preset.giant === 8 && preset.giants === 1)?.id ?? null;
	const same = (preset: Preset) => preset.values?.length === setup.opening.length && preset.values.every((value, index) => value === setup.opening[index]);
	return setup.presets.find(same)?.id ?? null;
}

export function initialState(setupId: SetupId): DescriptiveState {
	const setup = getSetup(setupId);
	return {
		setupId,
		stage: setup.openingStage,
		values: setup.opening,
		linedUp: false,
		pick: null,
		checked: false,
		failedChecks: 0,
		feedback: null,
		selected: 0,
		distances: false,
		sample: false,
		ghost: null,
		newcomer: null,
		newcomerValue: setup.newcomerOpening ?? 0,
		scale: 'raw',
		giant: setup.kind === 'outliers' ? setup.opening[setup.opening.length - 1] : 0,
		giants: 1,
		cutoff: 2,
		activePreset: openingPreset(setup),
		refusal: null,
	};
}

/** On line-up setups the summary (mean, median, mode, places) waits until Check finds the middle child. */
export function isCovered(state: DescriptiveState): boolean {
	return setupOf(state).kind === 'lineup' && !state.checked;
}

export function stageAllowed(state: DescriptiveState, stage: Stage): boolean {
	const setup = setupOf(state);
	return setup.stages.includes(stage) && guided.stageAllowed(stage, { stages: setup.stages.length > 0, waitsForCheck: setup.waitsForCheck, covered: isCovered(state) });
}

/** The list the statistics describe: with the newcomer on newcomer setups. */
export function valuesNow(state: DescriptiveState): readonly number[] {
	return state.newcomer === null ? state.values : [...state.values, state.newcomer];
}

/** The child whose height is the median: the one with as many shorter as taller. */
export function middleChild(values: readonly number[]): number {
	const middle = median(values);
	const index = values.findIndex((value) => middle.denominator === 1 && value === middle.numerator);
	if (index < 0) throw new Error('DescriptiveStats: no child stands at the median height.');
	return index;
}

export function isMiddle(values: readonly number[], child: number): boolean {
	const rank = rankOf(values, child);
	return rank.shorter === rank.taller && rank.same === 0;
}

/** Every change to the values goes through here: stale feedback and refusals are cleared. */
function withValues(state: DescriptiveState, values: readonly number[], activePreset: string | null): DescriptiveState {
	return { ...state, values, activePreset, refusal: null };
}

function check(setup: Setup, state: DescriptiveState): DescriptiveState {
	if (setup.kind !== 'lineup' || state.checked) return state;
	if (state.pick === null) return { ...state, refusal: { kind: 'no-pick' } };
	const right = isMiddle(state.values, state.pick);
	const progress = guided.recordCheck(state, right, 'retry');
	return { ...state, ...progress, feedback: { kind: right ? 'right' : 'wrong', child: state.pick }, refusal: null };
}

function applyPreset(setup: Setup, state: DescriptiveState, preset: Preset): DescriptiveState {
	if (setup.kind === 'newcomer') {
		const on = preset.newcomer ?? null;
		return { ...withValues(state, state.values, preset.id), newcomer: on, newcomerValue: on ?? state.newcomerValue };
	}
	if (setup.kind === 'outliers' && preset.giant !== undefined && preset.giants !== undefined) {
		return { ...withValues(state, pumpkins(preset.giant, preset.giants), preset.id), giant: preset.giant, giants: preset.giants };
	}
	if (!preset.values) return state;
	const next = withValues(state, preset.values, preset.id);
	if (setup.kind === 'spread' && state.activePreset !== null && state.activePreset !== preset.id) {
		const previous = presetById(setup, state.activePreset);
		if (previous) return { ...next, ghost: { sigma: populationSD(state.values), preset: previous.label } };
	}
	return next;
}

function clampToSlider(setup: Setup, value: number): number {
	if (!setup.slider) throw new Error(`DescriptiveStats: setup "${setup.id}" has no slider to set.`);
	if (!Number.isInteger(value)) throw new Error(`DescriptiveStats: setup "${setup.id}" got a slider value of ${value}; it must be a whole number.`);
	return Math.min(Math.max(value, setup.slider.min), setup.slider.max);
}

function setValue(setup: Setup, state: DescriptiveState, raw: number): DescriptiveState {
	if (setup.kind === 'spread') {
		const value = clampToSlider(setup, raw);
		return withValues(state, state.values.map((height, child) => (child === state.selected ? value : height)), null);
	}
	if (setup.kind === 'newcomer') {
		const value = clampToSlider(setup, raw);
		return { ...withValues(state, state.values, null), newcomerValue: value, newcomer: state.newcomer === null ? null : value };
	}
	if (setup.kind === 'outliers') {
		const value = clampToSlider(setup, raw);
		return { ...withValues(state, pumpkins(value, state.giants), null), giant: value };
	}
	return state;
}

const validChild = (state: DescriptiveState, child: number) => Number.isInteger(child) && child >= 0 && child < state.values.length;

/**
 * On newcomer and outlier setups a preset is just a newcomer or giant value, so the pressed preset follows the
 * values: moving the slider back to 1,000 presses "The millionaire" again.
 */
function withMatchingPreset(setup: Setup, state: DescriptiveState): DescriptiveState {
	if (setup.kind === 'newcomer') return { ...state, activePreset: setup.presets.find((preset) => preset.newcomer === state.newcomer)?.id ?? null };
	if (setup.kind === 'outliers') {
		const match = setup.presets.find((preset) => preset.giant === state.giant && preset.giants === state.giants);
		return { ...state, activePreset: match?.id ?? null };
	}
	return state;
}

export function reducer(state: DescriptiveState, action: Action): DescriptiveState {
	const setup = setupOf(state);
	return withMatchingPreset(setup, transition(setup, state, action));
}

function transition(setup: Setup, state: DescriptiveState, action: Action): DescriptiveState {
	switch (action.type) {
		case 'line-up':
			return setup.kind === 'lineup' ? { ...state, linedUp: action.on, refusal: null } : state;
		case 'pick':
			if (setup.kind !== 'lineup' || state.checked || !validChild(state, action.child)) return state;
			return { ...state, pick: action.child, feedback: null, refusal: null };
		case 'check':
			return check(setup, state);
		case 'show-answer': {
			if (setup.kind !== 'lineup' || !guided.canShowAnswer(state)) return state;
			const child = middleChild(state.values);
			return { ...state, checked: true, pick: child, feedback: { kind: 'shown', child }, refusal: null };
		}
		case 'select':
			return setup.kind === 'spread' && validChild(state, action.child) ? { ...state, selected: action.child, refusal: null } : state;
		case 'set-value':
			return setValue(setup, state, action.value);
		case 'preset': {
			const preset = presetById(setup, action.id);
			return preset ? applyPreset(setup, state, preset) : state;
		}
		case 'stage':
			return stageAllowed(state, action.stage) ? { ...state, stage: action.stage, refusal: null } : state;
		case 'distances':
			return setup.kind === 'spread' ? { ...state, distances: action.on, refusal: null } : state;
		case 'sample':
			return setup.kind === 'spread' ? { ...state, sample: action.on, refusal: null } : state;
		case 'newcomer':
			if (setup.kind !== 'newcomer') return state;
			return { ...withValues(state, state.values, null), newcomer: action.on ? state.newcomerValue : null };
		case 'scale':
			return setup.kind === 'scaling' && SCALES.includes(action.scale) ? { ...state, scale: action.scale, refusal: null } : state;
		case 'cutoff':
			return setup.kind === 'outliers' && CUTOFFS.includes(action.cutoff) ? { ...state, cutoff: action.cutoff, refusal: null } : state;
		case 'reset':
			return initialState(state.setupId);
	}
}
