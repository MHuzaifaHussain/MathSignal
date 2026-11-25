// The family mode's state and every transition, as a pure reducer (decision 0018). The rules (what stays covered
// before Check, when the read bar clamps, when a ghost is made) live here, so scripts/check-boards.mjs checks them.
import type { Fraction } from '../boardMath.ts';
import * as guided from '../guided/guided.ts';
import { binomial, binomialMoments } from './families.ts';
import { getFamilySetup, type FamilyPreset, type FamilySetup, type FamilySetupId, type GuessId } from './familySetups.ts';
import type { Distribution } from './model.ts';

/** Why a press was refused; the board says the matching sentence. */
export type FamilyRefusal = 'no-guess' | 'locked' | 'read-below' | 'read-above';

export interface FamilyState {
	setupId: FamilySetupId;
	n: number;
	/** p = j/20. */
	j: number;
	/** The value "Read the bar for" points at, 0..n. */
	read: number;
	guess: GuessId | null;
	/** True once Check has run on a guess setup (mode `once`: any committed guess reveals). */
	checked: boolean;
	failedChecks: number;
	spreadShown: boolean;
	/** The previous preset's variance, kept exact so its σ reads "= 0.5" or "≈ 1.58" like the live one. */
	ghost: { variance: Fraction; preset: string } | null;
	/** "Table view" (decision 0017): off at the start and after Reset. */
	tableOpen: boolean;
	refusal: FamilyRefusal | null;
}

export type FamilyAction =
	| { type: 'n'; n: number }
	| { type: 'p'; j: number }
	| { type: 'read'; direction: 1 | -1 }
	| { type: 'guess'; guess: GuessId }
	| { type: 'check' }
	| { type: 'preset'; name: string }
	| { type: 'spread'; on: boolean }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

/** From this many coins on, a guess setup covers its chart until Check. */
export const COVER_FROM_N = 4;

export const familySetupOf = (state: FamilyState): FamilySetup => getFamilySetup(state.setupId);

export function initialFamilyState(setupId: FamilySetupId): FamilyState {
	const setup = getFamilySetup(setupId);
	return {
		setupId,
		n: setup.nOpening,
		j: setup.jOpening,
		read: setup.readOpening,
		guess: null,
		checked: false,
		failedChecks: 0,
		spreadShown: false,
		ghost: null,
		tableOpen: false,
		refusal: null,
	};
}

export const familyDistribution = (state: FamilyState): Distribution => binomial(state.n, state.j);
export const familyMoments = (state: FamilyState) => binomialMoments(state.n, state.j);

/** The preset showing now, derived from (n, j); null once a slider has moved away from every preset. */
export function activePreset(state: FamilyState): FamilyPreset | null {
	return familySetupOf(state).presets.find((preset) => preset.n === state.n && preset.j === state.j) ?? null;
}

/** A guess setup hides its chart, readouts and table for 4 or more coins until Check. */
export function isCovered(state: FamilyState): boolean {
	return familySetupOf(state).kind === 'guess' && !state.checked && state.n >= COVER_FROM_N;
}

/** Presets wait for Check on a guess setup; the read pair waits only while the chart is covered. */
export const presetsLocked = (state: FamilyState) => familySetupOf(state).kind === 'guess' && !state.checked;

/** Why a read press in `direction` would be refused right now, or null. */
export function readBlocked(state: FamilyState, direction: 1 | -1): FamilyRefusal | null {
	if (isCovered(state)) return 'locked';
	if (state.read + direction < 0) return 'read-below';
	if (state.read + direction > state.n) return 'read-above';
	return null;
}

/** The ghost survives only while it differs from the preset showing: an identical one compares nothing. */
export function visibleGhost(state: FamilyState): FamilyState['ghost'] {
	if (!state.ghost || !state.spreadShown) return null;
	return activePreset(state)?.name === state.ghost.preset ? null : state.ghost;
}

function assertKind(state: FamilyState, kind: FamilySetup['kind'], action: FamilyAction['type']): void {
	const setup = familySetupOf(state);
	if (setup.kind !== kind) throw new Error(`DistributionBoard: "${action}" belongs to ${kind} setups, not "${setup.id}".`);
}

/** Every change of n or p goes through here: the read bar clamps to n, and a covered board never holds the table. */
function withTrials(state: FamilyState, n: number, j: number): FamilyState {
	const next = { ...state, n, j, read: Math.min(state.read, n), refusal: null };
	return isCovered(next) ? { ...next, tableOpen: false } : next;
}

function applyPreset(state: FamilyState, name: string): FamilyState {
	const setup = familySetupOf(state);
	const preset = setup.presets.find((candidate) => candidate.name === name);
	if (!preset) return state;
	if (presetsLocked(state)) return { ...state, refusal: 'locked' };
	const before = activePreset(state);
	const next = withTrials(state, preset.n, preset.j);
	// Decision 0012's ghost: only a change from one named preset to another, while the spread shows.
	if (setup.kind === 'spread' && state.spreadShown && before && before.name !== name) {
		return { ...next, ghost: { variance: familyMoments(state).variance, preset: before.name } };
	}
	return next;
}

function applyCheck(state: FamilyState): FamilyState {
	assertKind(state, 'guess', 'check');
	const guess = familySetupOf(state).guess;
	if (!guess || state.checked) return state;
	if (!state.guess) return { ...state, refusal: 'no-guess' };
	const progress = guided.recordCheck(state, state.guess === guess.answer, 'once');
	return { ...withTrials({ ...state, ...progress }, guess.checkN, state.j), read: guess.checkRead };
}

export function familyReducer(state: FamilyState, action: FamilyAction): FamilyState {
	switch (action.type) {
		case 'n': {
			const setup = familySetupOf(state);
			const n = Math.min(Math.max(Math.round(action.n), setup.nRange[0]), setup.nRange[1]);
			return withTrials(state, n, state.j);
		}
		case 'p': {
			assertKind(state, 'spread', 'p');
			const setup = familySetupOf(state);
			return withTrials(state, state.n, Math.min(Math.max(Math.round(action.j), setup.jRange[0]), setup.jRange[1]));
		}
		case 'read': {
			const blocked = readBlocked(state, action.direction);
			return blocked ? { ...state, refusal: blocked } : { ...state, read: state.read + action.direction, refusal: null };
		}
		case 'guess':
			assertKind(state, 'guess', 'guess');
			return state.checked ? state : { ...state, guess: action.guess, refusal: null };
		case 'check':
			return applyCheck(state);
		case 'preset':
			return applyPreset(state, action.name);
		case 'spread':
			assertKind(state, 'spread', 'spread');
			return action.on ? { ...state, spreadShown: true, refusal: null } : { ...state, spreadShown: false, ghost: null, refusal: null };
		case 'table':
			// A covered board renders no table and so no switch; it never holds the switch on.
			return isCovered(state) ? state : { ...state, tableOpen: action.open, refusal: null };
		case 'reset':
			return initialFamilyState(state.setupId);
	}
}
