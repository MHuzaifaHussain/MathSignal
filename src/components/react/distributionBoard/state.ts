// DistributionBoard's state and every transition, as a pure reducer. React only stores the result; the rules
// (what stays covered before Check, when steppers are locked, what a preset re-parks) are all here, so they are
// checked by scripts/check-boards.mjs.
import type { OutcomeId } from '../eventSpace/model.ts';
import * as guided from '../guided/guided.ts';
import { distributionOf, standardDeviation, type Distribution } from './model.ts';
import { outcomesOf } from './sources.ts';
import { getSetup, presetValues, zipValues, type Setup, type SetupId } from './setups.ts';

export type Stage = 'pictures' | 'numbers' | 'symbols';
/** Check's verdict, or `shown` when the reader gave up and pressed "Show the answer" (no "Yes" for that). */
export type Feedback =
	| { kind: 'match' }
	| { kind: 'shown' }
	| { kind: 'one-wrong'; id: OutcomeId; set: number; card: number }
	| { kind: 'several-wrong'; ids: OutcomeId[] };
export type Refusal = { kind: 'below-range' | 'above-range' | 'locked' | 'parked' | 'not-editable'; id?: OutcomeId };

export interface DistributionState {
	setupId: SetupId;
	values: Readonly<Record<OutcomeId, number>>;
	/** True once Check has passed (or the answer was shown) on a goal setup. */
	checked: boolean;
	failedChecks: number;
	feedback: Feedback | null;
	/** The follow-up goal after the card matches: null where there is none. */
	goal: null | 'open' | 'passed' | 'not-yet';
	stage: Stage;
	/** The pencil's whole-number position k; it sits at k / W. */
	pencil: number;
	/**
	 * The k the reader pressed "Balance it" at, or null before that. The verdict judges this guess, so moving the
	 * pencil afterward to explore doesn't rewrite it.
	 */
	guess: number | null;
	/** Whether μ is shown: after "Balance it" on balance setups, from the start on spread setups. */
	revealed: boolean;
	spreadShown: boolean;
	/** The preset the values came from, or null once the reader has stepped away from it. */
	activePreset: string | null;
	/** The previous preset's σ, drawn dashed so the reader can compare. */
	ghost: { sigma: number; preset: string } | null;
	refusal: Refusal | null;
}

export type Action =
	| { type: 'step'; id: OutcomeId; direction: 1 | -1 }
	| { type: 'preset'; name: string }
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'check-goal' }
	| { type: 'stage'; stage: Stage }
	| { type: 'pencil'; k: number }
	| { type: 'balance' }
	| { type: 'spread'; on: boolean }
	| { type: 'reset' };

/** Where the parked pencil sits, under no bar: half a step left of 0. Its k is −W/2. */
export const PARKED = -0.5;

export function setupOf(state: DistributionState): Setup {
	return getSetup(state.setupId);
}

export function parkedPencil(setup: Setup): number {
	return PARKED * setup.stepDenominator;
}

function sameValues(setup: Setup, values: Readonly<Record<OutcomeId, number>>, list: readonly number[]): boolean {
	return outcomesOf(setup.source).every((outcome, index) => values[outcome.id] === list[index]);
}

/** The preset whose values the board opens on, so a ghost can name it; null when the opening isn't a preset. */
function openingPreset(setup: Setup): string | null {
	const opening = zipValues(setup, setup.opening);
	return setup.presets.find((name) => sameValues(setup, opening, presetValues(setup, name))) ?? null;
}

export function initialState(setupId: SetupId): DistributionState {
	const setup = getSetup(setupId);
	return {
		setupId,
		values: zipValues(setup, setup.opening),
		checked: false,
		failedChecks: 0,
		feedback: null,
		goal: null,
		stage: 'numbers',
		pencil: parkedPencil(setup),
		guess: null,
		revealed: setup.kind === 'spread',
		spreadShown: false,
		activePreset: openingPreset(setup),
		ghost: null,
		refusal: null,
	};
}

/** On a goal setup the chart, fractions and table stay covered until Check matches the card. */
export function isCovered(state: DistributionState): boolean {
	return setupOf(state).kind === 'goal' && !state.checked;
}

export function distributionNow(state: DistributionState): Distribution {
	return distributionOf(outcomesOf(setupOf(state).source), state.values);
}

/** Symbols comes last on goal setups, so it waits for the match. */
export function stageAllowed(state: DistributionState, stage: Stage): boolean {
	return guided.stageAllowed(stage, { stages: setupOf(state).stages, waitsForCheck: ['symbols'], covered: isCovered(state) });
}

/** Why a − / + would be refused right now, or null if it would go through. */
export function stepBlocked(state: DistributionState, id: OutcomeId, direction: 1 | -1): Refusal['kind'] | null {
	const setup = setupOf(state);
	if (setup.editing === 'never') return 'not-editable';
	if (setup.editing === 'after-balance' && !state.revealed) return 'locked';
	const next = state.values[id] + direction;
	if (next < setup.range[0]) return 'below-range';
	if (next > setup.range[1]) return 'above-range';
	return null;
}

function hasOutcome(setup: Setup, id: OutcomeId): boolean {
	return outcomesOf(setup.source).some((outcome) => outcome.id === id);
}

/** The follow-up goal after the card: met when count / total equals the target chance, compared by cross-multiplying. */
function goalMet(setup: Setup, values: Readonly<Record<OutcomeId, number>>): boolean {
	const goal = setup.goalAfterCard;
	if (!goal) return false;
	const outcomes = outcomesOf(setup.source);
	const hitWeight = outcomes.filter((outcome) => values[outcome.id] === goal.value).reduce((total, outcome) => total + outcome.weight, 0);
	const totalWeight = outcomes.reduce((total, outcome) => total + outcome.weight, 0);
	return hitWeight * goal.chance.denominator === goal.chance.numerator * totalWeight;
}

/** The follow-up goal a fresh match opens, or null on setups without one. */
function openedGoal(setup: Setup): DistributionState['goal'] {
	return setup.goalAfterCard ? 'open' : null;
}

/**
 * Every value change goes through here. Stale feedback misleads, so it is cleared; a checked follow-up goal
 * goes back to open because the values it judged are gone. The balance guess goes for the same reason: it was a
 * guess about the old bars, so the verdict on it would be about a problem the reader never saw.
 */
function withValues(state: DistributionState, values: Readonly<Record<OutcomeId, number>>, activePreset: string | null): DistributionState {
	const goal = state.goal === null ? null : 'open';
	return { ...state, values, feedback: null, refusal: null, activePreset, goal, guess: null };
}

function checkCard(setup: Setup, state: DistributionState, card: readonly number[]): DistributionState {
	const wrong = outcomesOf(setup.source)
		.map((outcome, index) => ({ id: outcome.id, set: state.values[outcome.id], card: card[index] }))
		.filter((entry) => entry.set !== entry.card);
	const progress = guided.recordCheck(state, wrong.length === 0, 'retry');
	if (wrong.length === 0) return { ...state, ...progress, feedback: { kind: 'match' }, goal: openedGoal(setup), refusal: null };
	const feedback: Feedback = wrong.length === 1 ? { kind: 'one-wrong', ...wrong[0] } : { kind: 'several-wrong', ids: wrong.map((entry) => entry.id) };
	return { ...state, ...progress, feedback, refusal: null };
}

function applyPreset(setup: Setup, state: DistributionState, name: string): DistributionState {
	if (!setup.presets.includes(name)) return state;
	if (isCovered(state)) return { ...state, refusal: { kind: 'locked' } };
	const next = withValues(state, zipValues(setup, presetValues(setup, name)), name);
	if (setup.kind === 'balance') {
		// A new game is a new guess: the pencil parks and μ hides again.
		return { ...next, pencil: parkedPencil(setup), guess: null, revealed: false };
	}
	if (setup.kind === 'spread' && state.spreadShown && state.activePreset !== null && state.activePreset !== name) {
		return { ...next, ghost: { sigma: standardDeviation(distributionNow(state)), preset: state.activePreset } };
	}
	return next;
}

function applyStep(setup: Setup, state: DistributionState, id: OutcomeId, direction: 1 | -1): DistributionState {
	if (!hasOutcome(setup, id)) return state;
	const blocked = stepBlocked(state, id, direction);
	if (blocked) return { ...state, refusal: { kind: blocked, id } };
	return withValues(state, { ...state.values, [id]: state.values[id] + direction }, null);
}

function movePencil(setup: Setup, state: DistributionState, k: number): DistributionState {
	if (setup.kind !== 'balance') return state;
	if (!Number.isInteger(k)) throw new Error(`DistributionBoard: setup "${setup.id}" got a pencil position k = ${k}; it must be a whole number.`);
	const pencil = Math.min(Math.max(k, parkedPencil(setup)), setup.range[1] * setup.stepDenominator);
	return { ...state, pencil, refusal: null };
}

export function reducer(state: DistributionState, action: Action): DistributionState {
	const setup = setupOf(state);
	switch (action.type) {
		case 'step':
			return applyStep(setup, state, action.id, action.direction);
		case 'preset':
			return applyPreset(setup, state, action.name);
		case 'check':
			return setup.card && !state.checked ? checkCard(setup, state, setup.card) : state;
		case 'show-answer': {
			if (!setup.card || !guided.canShowAnswer(state)) return state;
			return { ...withValues(state, zipValues(setup, setup.card), null), checked: true, feedback: { kind: 'shown' }, goal: openedGoal(setup) };
		}
		case 'check-goal':
			if (!setup.goalAfterCard || !state.checked) return state;
			return { ...state, goal: goalMet(setup, state.values) ? 'passed' : 'not-yet', refusal: null };
		case 'stage':
			return stageAllowed(state, action.stage) ? { ...state, stage: action.stage, refusal: null } : state;
		case 'pencil':
			return movePencil(setup, state, action.k);
		case 'balance': {
			// Once revealed, the guess is in; pressing again must not swap it for the explored pencil.
			if (setup.kind !== 'balance' || state.revealed) return state;
			if (state.pencil === parkedPencil(setup)) return { ...state, refusal: { kind: 'parked' } };
			return { ...state, revealed: true, guess: state.pencil, refusal: null };
		}
		case 'spread': {
			if (setup.kind !== 'spread') return state;
			return action.on ? { ...state, spreadShown: true, refusal: null } : { ...state, spreadShown: false, ghost: null, refusal: null };
		}
		case 'reset':
			return initialState(state.setupId);
	}
}
