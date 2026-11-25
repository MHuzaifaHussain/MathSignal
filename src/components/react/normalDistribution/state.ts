// The z mode's state and its one reducer (decision 0019). The reader commits with one Check before the z ruler, the z
// text, the share and the other presets appear; `revealed` is the only gate the components and describe.ts read.
// Pure, so scripts/check-boards.mjs drives it.
import { recordCheck } from '../guided/guided.ts';
import { maxIndex } from './model.ts';
import { answerFor, getZPreset, getZSetup, type ZGuess, type ZPreset, type ZPresetId, type ZSetup, type ZSetupId } from './setups.ts';

export interface ZState {
	readonly setupId: ZSetupId;
	readonly presetId: ZPresetId;
	/** The value's step index: value = mean + index · step. Always whole and within ±maxIndex. */
	readonly index: number;
	readonly guess: ZGuess | null;
	readonly checked: boolean;
	readonly failedChecks: number;
	readonly shading: boolean;
	readonly tableOpen: boolean;
}

export type ZAction =
	| { type: 'preset'; id: ZPresetId }
	| { type: 'value'; index: number }
	| { type: 'guess'; guess: ZGuess }
	| { type: 'check' }
	| { type: 'shade'; on: boolean }
	| { type: 'table'; open: boolean }
	| { type: 'reset' };

export function initialState(setupId: ZSetupId): ZState {
	const setup = getZSetup(setupId);
	return {
		setupId,
		presetId: setup.opening,
		index: getZPreset(setup.opening).openingIndex,
		guess: null,
		checked: false,
		failedChecks: 0,
		shading: false,
		tableOpen: false,
	};
}

export const setupOf = (state: ZState): ZSetup => getZSetup(state.setupId);
export const presetOf = (state: ZState): ZPreset => getZPreset(state.presetId);

/** True once the reader has committed with Check. Everything that would answer the question waits for this. */
export const revealed = (state: ZState): boolean => state.checked;

/** The presets the tray offers: the setup's list minus the ones that wait for Check, until Check. */
export function allowedPresets(state: ZState): ZPresetId[] {
	const setup = setupOf(state);
	return setup.presets.filter((id) => revealed(state) || !setup.waitsForCommit.includes(id));
}

/** The preset drawn pressed: the current one while the value is still its opening value. */
export function activePresetId(state: ZState): ZPresetId | null {
	return state.index === presetOf(state).openingIndex ? state.presetId : null;
}

/** The board's one ochre element: the value marker and its handle. The shading is ink. */
export const ochreElement = (_state: ZState) => 'value-marker' as const;

/** A whole index on the preset's grid; a value from outside is rounded and clamped, never trusted. */
function onGrid(preset: ZPreset, index: number): number {
	if (!Number.isFinite(index)) throw new Error(`normalDistribution state: the value index ${index} is not finite`);
	const limit = maxIndex(preset);
	return Math.min(limit, Math.max(-limit, Math.round(index))) + 0;
}

export function zReducer(state: ZState, action: ZAction): ZState {
	switch (action.type) {
		case 'preset': {
			if (!allowedPresets(state).includes(action.id)) {
				throw new Error(`normalDistribution state: preset ${action.id} isn't offered yet, so its button can't be pressed`);
			}
			const preset = getZPreset(action.id);
			if (state.presetId === action.id && state.index === preset.openingIndex) return state;
			return { ...state, presetId: action.id, index: preset.openingIndex };
		}
		case 'value': {
			const index = onGrid(presetOf(state), action.index);
			return index === state.index ? state : { ...state, index };
		}
		case 'guess':
			return revealed(state) ? state : { ...state, guess: action.guess };
		case 'check': {
			if (revealed(state) || state.guess === null) return state;
			return { ...state, ...recordCheck(state, state.guess === answerFor(setupOf(state)), 'once') };
		}
		case 'shade':
			if (!revealed(state)) throw new Error('normalDistribution state: Shade waits for Check, so its switch can\'t be pressed yet');
			return { ...state, shading: action.on };
		case 'table':
			return { ...state, tableOpen: action.open };
		case 'reset':
			return initialState(state.setupId);
	}
}
