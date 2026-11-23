// EventSpace's state and every transition, as a pure reducer. React only stores the result; the rules
// (what is locked before Check, what Reset restores, which pours are refused) are all here, so they are
// checked by scripts/check-boards.mjs.
import { checkGoal, pour, type GoalResult, type OutcomeId } from './model.ts';
import { SCENARIOS, eventMembers, type Scenario } from './scenarios.ts';
import { CLEAR_PRESET, getSetup, type Setup, type SetupId } from './setups.ts';

export type EventKey = 'A' | 'B';
export type LookAt = 'everything' | 'A and B' | 'A or B' | 'not A';
export type Stage = 'picture' | 'letters' | 'sets';
export type Refusal = { id: OutcomeId; reason: 'cup-empty' | 'jug-empty' };

export interface EventSpaceState {
	setupId: SetupId;
	events: Record<EventKey, ReadonlySet<OutcomeId>>;
	editing: EventKey;
	lookAt: LookAt;
	/** True once Check has passed (or the answer was shown) on a goal setup. */
	checked: boolean;
	failedChecks: number;
	feedback: GoalResult | null;
	weights: Record<OutcomeId, number>;
	refusal: Refusal | null;
	tallies: Record<OutcomeId, number>;
	tossCount: number;
	wrongModel: boolean;
	stage: Stage;
}

export type Action =
	| { type: 'toggle'; id: OutcomeId }
	| { type: 'preset'; event: EventKey; preset: string }
	| { type: 'edit'; event: EventKey }
	| { type: 'look'; lookAt: LookAt }
	| { type: 'check' }
	| { type: 'show-answer' }
	| { type: 'reset' }
	| { type: 'pour'; id: OutcomeId; direction: 1 | -1 }
	| { type: 'weight-preset'; name: string };

/** Wrong Checks before the "Show the answer" button appears. */
export const CHECKS_BEFORE_ANSWER = 2;
const EMPTY: ReadonlySet<OutcomeId> = new Set();

export function setupOf(state: EventSpaceState): Setup {
	return getSetup(state.setupId);
}

export function scenarioOf(state: EventSpaceState): Scenario {
	return SCENARIOS[setupOf(state).scenario];
}

function presetMembers(scenario: Scenario, preset: string | null): ReadonlySet<OutcomeId> {
	return preset === null || preset === CLEAR_PRESET ? EMPTY : eventMembers(scenario, preset);
}

function weightsFor(scenario: Scenario, fills: readonly number[] | undefined): Record<OutcomeId, number> {
	if (!fills) return {};
	return Object.fromEntries(scenario.outcomes.map((outcome, index) => [outcome.id, fills[index] ?? 0]));
}

export function initialState(setupId: SetupId): EventSpaceState {
	const setup = getSetup(setupId);
	const scenario = SCENARIOS[setup.scenario];
	return {
		setupId,
		events: { A: presetMembers(scenario, setup.events.A.initial), B: presetMembers(scenario, setup.events.B?.initial ?? null) },
		editing: 'A',
		lookAt: 'everything',
		checked: false,
		failedChecks: 0,
		feedback: null,
		weights: weightsFor(scenario, setup.initialWeights ? setup.weightPresets?.[setup.initialWeights] : undefined),
		refusal: null,
		tallies: {},
		tossCount: 0,
		wrongModel: false,
		stage: 'letters',
	};
}

/** On a goal setup, presets, readouts and tosses stay locked until the reader passes Check. */
export function isLocked(state: EventSpaceState): boolean {
	return Boolean(setupOf(state).goal) && !state.checked;
}

/** Why a pour would be refused right now, or null if it would go through. */
export function pourBlocked(state: EventSpaceState, id: OutcomeId, direction: 1 | -1): Refusal['reason'] | null {
	const result = pour(state.weights, id, direction);
	return result.ok ? null : result.reason;
}

function withEvent(state: EventSpaceState, key: EventKey, members: ReadonlySet<OutcomeId>): EventSpaceState {
	return { ...state, events: { ...state.events, [key]: members }, feedback: state.checked ? state.feedback : null, refusal: null };
}

function toggled(members: ReadonlySet<OutcomeId>, id: OutcomeId): ReadonlySet<OutcomeId> {
	const next = new Set(members);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}

export function reducer(state: EventSpaceState, action: Action): EventSpaceState {
	const setup = setupOf(state);
	const scenario = SCENARIOS[setup.scenario];
	switch (action.type) {
		case 'toggle': {
			const event = setup.events[state.editing];
			if (setup.mode !== 'count' || !event?.editable || !scenario.outcomes.some((outcome) => outcome.id === action.id)) return state;
			return withEvent(state, state.editing, toggled(state.events[state.editing], action.id));
		}
		case 'preset': {
			const event = setup.events[action.event];
			if (isLocked(state) || !event?.presets.includes(action.preset)) return state;
			return withEvent(state, action.event, presetMembers(scenario, action.preset));
		}
		case 'edit':
			return setup.events[action.event] ? { ...state, editing: action.event } : state;
		case 'look':
			return setup.lookAt ? { ...state, lookAt: action.lookAt } : state;
		case 'check': {
			if (!setup.goal || state.checked) return state;
			const feedback = checkGoal(state.events.A, eventMembers(scenario, setup.goal), scenario.mirrorOf);
			return feedback.kind === 'correct'
				? { ...state, checked: true, feedback }
				: { ...state, failedChecks: state.failedChecks + 1, feedback };
		}
		case 'show-answer': {
			if (!setup.goal || state.checked || state.failedChecks < CHECKS_BEFORE_ANSWER) return state;
			return { ...state, events: { ...state.events, A: eventMembers(scenario, setup.goal) }, checked: true, feedback: { kind: 'correct' } };
		}
		case 'reset':
			return initialState(state.setupId);
		case 'pour': {
			if (setup.mode !== 'weights') return state;
			const result = pour(state.weights, action.id, action.direction);
			return result.ok ? { ...state, weights: result.weights, refusal: null } : { ...state, refusal: { id: action.id, reason: result.reason } };
		}
		case 'weight-preset': {
			const fills = setup.weightPresets?.[action.name];
			return fills ? { ...state, weights: weightsFor(scenario, fills), refusal: null } : state;
		}
	}
}
