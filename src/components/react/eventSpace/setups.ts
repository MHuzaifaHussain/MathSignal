// The board configurations pages pick with <EventSpace setup="…" />. Each one fixes the outcome space,
// the mode, the opening events and the presets (design doc: "Opening state of each setup").
import { WEIGHT_TOTAL } from './model.ts';
import { SCENARIOS, type ScenarioId } from './scenarios.ts';

export type SetupId = 'coins-build' | 'dice-count' | 'dice-operations' | 'die-pour' | 'dice-condition' | 'kids-condition';

/** The built-in preset that empties an event. */
export const CLEAR_PRESET = 'clear';
const MAX_PRESETS_PER_EVENT = 4;

export interface EventSetup {
	editable: boolean;
	/** A scenario event id, or null for the empty event. */
	initial: string | null;
	/** Scenario event ids, or CLEAR_PRESET. */
	presets: string[];
}

export interface Setup {
	id: SetupId;
	scenario: ScenarioId;
	/** count: equally likely outcomes. weights: cups poured from a jug. condition: count, plus shrinking the world to B. */
	mode: 'count' | 'weights' | 'condition';
	/** The board's accessible name. */
	label: string;
	/** On a goal setup the reader marks this event and presses Check before anything else unlocks. */
	goal?: string;
	events: { A: EventSetup; B?: EventSetup };
	lookAt: boolean;
	/** Weights mode: named starting fills of the six cups, in units out of 12. */
	weightPresets?: Record<string, number[]>;
	initialWeights?: string;
	stages: boolean;
	toss: boolean;
	wrongModel: boolean;
}

const COUNT_DEFAULTS = { mode: 'count', lookAt: false, stages: false, toss: false, wrongModel: false } as const;

const SETUPS: Record<SetupId, Setup> = {
	'coins-build': {
		...COUNT_DEFAULTS,
		id: 'coins-build',
		scenario: 'two-coins',
		label: 'The outcomes of tossing two coins. Mark the outcomes in event A, then press Check.',
		goal: 'at-least-one-head',
		events: { A: { editable: true, initial: null, presets: ['at-least-one-head', 'exactly-one-head', 'both-same', CLEAR_PRESET] } },
		stages: true,
		toss: true,
		wrongModel: true,
	},
	'dice-count': {
		...COUNT_DEFAULTS,
		id: 'dice-count',
		scenario: 'two-dice',
		label: 'The 36 outcomes of rolling two dice. Mark outcomes to build event A.',
		events: { A: { editable: true, initial: null, presets: ['sum-7', 'sum-2', CLEAR_PRESET] } },
	},
	'dice-operations': {
		...COUNT_DEFAULTS,
		id: 'dice-operations',
		scenario: 'two-dice',
		label: 'The 36 outcomes of rolling two dice, with two events, A and B.',
		events: {
			A: { editable: true, initial: 'sum-7', presets: ['sum-7', 'double', CLEAR_PRESET] },
			B: { editable: true, initial: 'first-6', presets: ['first-6', 'second-6', CLEAR_PRESET] },
		},
		lookAt: true,
	},
	'die-pour': {
		...COUNT_DEFAULTS,
		id: 'die-pour',
		scenario: 'one-die',
		mode: 'weights',
		label: 'A die as six cups of probability, poured from a jug of 12 units.',
		events: { A: { editable: false, initial: 'even', presets: ['even', 'at-most-2', 'six'] } },
		weightPresets: {
			'Fair die': [2, 2, 2, 2, 2, 2],
			'Loaded toward six': [1, 1, 1, 1, 1, 7],
			'Start over': [0, 0, 0, 0, 0, 0],
		},
		initialWeights: 'Fair die',
	},
	'dice-condition': {
		...COUNT_DEFAULTS,
		id: 'dice-condition',
		scenario: 'two-dice',
		mode: 'condition',
		label: 'The 36 outcomes of rolling two dice, with event A and the event B you can shrink the world to.',
		events: {
			A: { editable: true, initial: 'sum-at-least-10', presets: ['sum-at-least-10', CLEAR_PRESET] },
			B: { editable: true, initial: 'double', presets: ['double', CLEAR_PRESET] },
		},
	},
	'kids-condition': {
		...COUNT_DEFAULTS,
		id: 'kids-condition',
		scenario: 'kids',
		mode: 'condition',
		label: 'A class of 12 children, one picked at random. A: wears a scarf. B: wears a hat.',
		events: {
			A: { editable: false, initial: 'scarf', presets: [] },
			B: { editable: false, initial: 'hat', presets: [] },
		},
	},
};

/** Throws, naming the setup, if any part of its configuration can't work. Exported so the board check can test it. */
export function validateSetup(setup: Setup): Setup {
	const scenario = SCENARIOS[setup.scenario];
	for (const [key, event] of Object.entries(setup.events)) {
		if (!event) continue;
		if (event.presets.length > MAX_PRESETS_PER_EVENT) {
			throw new Error(`EventSpace: setup "${setup.id}" gives event ${key} ${event.presets.length} presets; the most is ${MAX_PRESETS_PER_EVENT}.`);
		}
		for (const preset of [...event.presets, ...(event.initial ? [event.initial] : [])]) {
			if (preset !== CLEAR_PRESET && !scenario.events[preset]) {
				throw new Error(`EventSpace: setup "${setup.id}" uses "${preset}", which scenario "${scenario.id}" doesn't define.`);
			}
		}
	}
	if (setup.mode === 'condition') {
		// Conditioning needs a B to shrink to. Tosses would need a "keep only tosses where B happened" filter, and
		// "Look at" would be overridden while shrunk; neither is built, so a setup asking for them fails here.
		if (!setup.events.B) throw new Error(`EventSpace: condition setup "${setup.id}" needs an event B to shrink to.`);
		if (setup.toss) throw new Error(`EventSpace: condition setup "${setup.id}" can't toss yet; tosses there would need filtering to B.`);
		if (setup.lookAt) throw new Error(`EventSpace: condition setup "${setup.id}" can't use "Look at"; shrinking to B replaces it.`);
	}
	if (setup.goal && !scenario.events[setup.goal]) throw new Error(`EventSpace: setup "${setup.id}" has an unknown goal "${setup.goal}".`);
	// The "missed" outline after Check and the strike on cells outside "Look at" or B are drawn by the same pseudo-element.
	if (setup.goal && (setup.lookAt || setup.mode === 'condition')) {
		throw new Error(`EventSpace: goal setup "${setup.id}" can't use "Look at" or conditioning; a missed square would lose its outline.`);
	}
	for (const [name, fills] of Object.entries(setup.weightPresets ?? {})) {
		if (fills.length !== scenario.outcomes.length) throw new Error(`EventSpace: setup "${setup.id}" weight preset "${name}" has ${fills.length} cups; scenario "${scenario.id}" has ${scenario.outcomes.length}.`);
		if (!fills.every((units) => Number.isInteger(units) && units >= 0)) throw new Error(`EventSpace: setup "${setup.id}" weight preset "${name}" needs whole numbers of units, 0 or more.`);
		const total = fills.reduce((sum, units) => sum + units, 0);
		if (total > WEIGHT_TOTAL) throw new Error(`EventSpace: setup "${setup.id}" weight preset "${name}" pours ${total} units; the jug holds ${WEIGHT_TOTAL}.`);
	}
	if (setup.initialWeights && !setup.weightPresets?.[setup.initialWeights]) {
		throw new Error(`EventSpace: setup "${setup.id}" has initialWeights "${setup.initialWeights}", which isn't one of its weight presets.`);
	}
	return setup;
}

export function getSetup(id: string): Setup {
	const setup = SETUPS[id as SetupId];
	if (!setup) throw new Error(`EventSpace: unknown setup "${id}". Known setups: ${Object.keys(SETUPS).join(', ')}.`);
	return validateSetup(setup);
}
