// The board configurations pages pick with <EventSpace setup="…" />. Each one fixes the outcome space,
// the mode, the opening events and the presets (design doc: "Opening state of each setup").
import { WEIGHT_TOTAL } from './model.ts';
import { SCENARIOS, type ScenarioId } from './scenarios.ts';

export type SetupId =
	| 'coins-build'
	| 'dice-count'
	| 'dice-operations'
	| 'die-pour'
	| 'dice-condition'
	| 'kids-condition'
	| 'coin-die-independence'
	| 'dice-independence'
	| 'weather-exclusive'
	| 'die-compare'
	| 'monty-condition';

/** The built-in preset that empties an event. */
export const CLEAR_PRESET = 'clear';
const MAX_PRESETS_PER_EVENT = 4;
/** The only space a compare setup may weigh: its copy ("every face") assumes one die. */
const WEIGHABLE_IN_COMPARE: ScenarioId = 'one-die';

/** The die fills shared by the axioms page's jug and the comparison page, so both mean the same "loaded". */
export const DIE_WEIGHT_PRESETS: Readonly<Record<string, readonly number[]>> = {
	'Fair die': [2, 2, 2, 2, 2, 2],
	'Loaded toward six': [1, 1, 1, 1, 1, 7],
};

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
	/**
	 * count: equally likely outcomes. weights: cups poured from a jug. condition: count, plus shrinking the world
	 * to B. compare: two events, plus a switch that reveals whether they are independent and mutually exclusive.
	 */
	mode: 'count' | 'weights' | 'condition' | 'compare';
	/** The board's accessible name. */
	label: string;
	/** On a goal setup the reader marks this event and presses Check before anything else unlocks. */
	goal?: string;
	events: { A: EventSetup; B?: EventSetup };
	lookAt: boolean;
	/** Offers "Shrink the world to B": required in condition mode, optional in compare mode, never with weights. */
	shrinkSwitch: boolean;
	/** Weights and compare modes: named fills of the six faces, in units out of 12. */
	weightPresets?: Readonly<Record<string, readonly number[]>>;
	initialWeights?: string;
	stages: boolean;
	toss: boolean;
	wrongModel: boolean;
	/**
	 * Condition mode: hold the "A and B" line until the world is shrunk to B. Set where |A ∩ B| beside |B| would
	 * already be the answer the page asks the reader to find by shrinking.
	 */
	holdOverlap?: boolean;
	/** A handwritten note beside the grid (ChalkNote): qualitative only, never a number. */
	chalkNote?: { long: string; short: string };
}

const COUNT_DEFAULTS = { mode: 'count', lookAt: false, shrinkSwitch: false, stages: false, toss: false, wrongModel: false } as const;

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
		weightPresets: { ...DIE_WEIGHT_PRESETS, 'Start over': [0, 0, 0, 0, 0, 0] },
		initialWeights: 'Fair die',
	},
	'dice-condition': {
		...COUNT_DEFAULTS,
		id: 'dice-condition',
		scenario: 'two-dice',
		mode: 'condition',
		shrinkSwitch: true,
		holdOverlap: true,
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
		shrinkSwitch: true,
		holdOverlap: true,
		label: 'A class of 12 children, one picked at random. A: wears a scarf. B: wears a hat.',
		events: {
			A: { editable: false, initial: 'scarf', presets: [] },
			B: { editable: false, initial: 'hat', presets: [] },
		},
	},
	'coin-die-independence': {
		...COUNT_DEFAULTS,
		id: 'coin-die-independence',
		scenario: 'coin-die',
		mode: 'compare',
		shrinkSwitch: true,
		label: 'The 12 outcomes of flipping a coin and rolling a die, with events A and B to compare.',
		events: {
			A: { editable: true, initial: 'die-6', presets: ['die-6', 'die-even', 'heads-and-six', CLEAR_PRESET] },
			B: { editable: true, initial: 'heads', presets: ['heads', 'tails', CLEAR_PRESET] },
		},
	},
	'dice-independence': {
		...COUNT_DEFAULTS,
		id: 'dice-independence',
		scenario: 'two-dice',
		mode: 'compare',
		shrinkSwitch: true,
		label: 'The 36 outcomes of rolling two dice, with events A and B to compare.',
		events: {
			A: { editable: true, initial: 'sum-7', presets: ['sum-7', 'sum-8', 'double', 'sum-at-least-10'] },
			B: { editable: true, initial: 'first-6', presets: ['first-6', 'second-6', 'double', CLEAR_PRESET] },
		},
	},
	'weather-exclusive': {
		...COUNT_DEFAULTS,
		id: 'weather-exclusive',
		scenario: 'weather-days',
		mode: 'compare',
		shrinkSwitch: true,
		label: '12 days from one spring, one picked at random, with events A and B to compare.',
		events: {
			A: { editable: false, initial: 'rain-all-day', presets: ['rain-all-day', 'some-rain'] },
			B: { editable: false, initial: 'sun-all-day', presets: ['sun-all-day', 'some-sun'] },
		},
	},
	'die-compare': {
		...COUNT_DEFAULTS,
		id: 'die-compare',
		scenario: 'one-die',
		mode: 'compare',
		label: 'One roll of a die, fair or loaded, with events A and B to compare.',
		events: {
			A: { editable: false, initial: 'at-most-2', presets: ['at-most-2', 'even', CLEAR_PRESET] },
			B: { editable: false, initial: 'five-or-six', presets: ['five-or-six', 'even', 'at-least-4', 'at-most-2'] },
		},
		weightPresets: DIE_WEIGHT_PRESETS,
		initialWeights: 'Fair die',
	},
	'monty-condition': {
		...COUNT_DEFAULTS,
		id: 'monty-condition',
		scenario: 'monty-hall',
		mode: 'condition',
		shrinkSwitch: true,
		holdOverlap: true,
		label: "Six equally likely games: where the car is and the host's coin. A: where the car is. B: the door the host opens.",
		events: {
			A: { editable: false, initial: 'car-1', presets: ['car-1', 'car-2', 'car-3'] },
			B: { editable: false, initial: 'opens-3', presets: ['opens-3', 'opens-2'] },
		},
		chalkNote: { long: "the coin column is the host's tie-break", short: 'coin = tie-break' },
	},
};

/** Whether the setup offers "Shrink the world to B". */
export function canShrink(setup: Setup): boolean {
	return setup.shrinkSwitch;
}

/** Whether tapping an outcome can change an event (if that event is editable): never while cups are poured. */
export function canToggle(setup: Setup): boolean {
	return setup.mode !== 'weights';
}

/** Throws, naming the setup, if any part of its configuration can't work. Exported so the board check can test it. */
export function validateSetup(setup: Setup): Setup {
	const scenario = SCENARIOS[setup.scenario];
	for (const [key, event] of Object.entries(setup.events)) {
		if (!event) continue;
		if (event.presets.length > MAX_PRESETS_PER_EVENT) {
			throw new Error(`EventSpace: setup "${setup.id}" gives event ${key} ${event.presets.length} presets; the most is ${MAX_PRESETS_PER_EVENT}.`);
		}
		for (const preset of [...event.presets, ...(event.initial ? [event.initial] : [])]) {
			if (preset !== CLEAR_PRESET && !Object.hasOwn(scenario.events, preset)) {
				throw new Error(`EventSpace: setup "${setup.id}" uses "${preset}", which scenario "${scenario.id}" doesn't define.`);
			}
		}
	}
	const hasB = setup.mode === 'condition' || setup.mode === 'compare';
	if (hasB) {
		// Both modes need a B. Tosses would need a "keep only tosses where B happened" filter, and "Look at" would be
		// overridden while shrunk; neither is built, so a setup asking for them fails here.
		if (!setup.events.B) throw new Error(`EventSpace: ${setup.mode} setup "${setup.id}" needs an event B to shrink to.`);
		if (setup.toss) throw new Error(`EventSpace: ${setup.mode} setup "${setup.id}" can't toss yet; tosses there would need filtering to B.`);
		if (setup.lookAt) throw new Error(`EventSpace: ${setup.mode} setup "${setup.id}" can't use "Look at"; shrinking to B replaces it.`);
	}
	if (setup.mode === 'condition' && !setup.shrinkSwitch) {
		throw new Error(`EventSpace: condition setup "${setup.id}" needs the shrink switch; conditioning is what the mode is for.`);
	}
	if (setup.shrinkSwitch && !hasB) {
		throw new Error(`EventSpace: ${setup.mode} setup "${setup.id}" can't shrink the world to B; only condition and compare setups can.`);
	}
	if (setup.goal && !scenario.events[setup.goal]) throw new Error(`EventSpace: setup "${setup.id}" has an unknown goal "${setup.goal}".`);
	// The "missed" outline after Check and the strike on cells outside "Look at" or B are drawn by the same pseudo-element.
	if (setup.goal && (setup.lookAt || hasB)) {
		throw new Error(`EventSpace: goal setup "${setup.id}" can't use "Look at" or conditioning; a missed square would lose its outline.`);
	}
	if (setup.holdOverlap && setup.mode !== 'condition') {
		throw new Error(`EventSpace: ${setup.mode} setup "${setup.id}" can't hold the "A and B" line; only condition setups show it before shrinking.`);
	}
	if (setup.chalkNote && /\d/.test(`${setup.chalkNote.long} ${setup.chalkNote.short}`)) {
		throw new Error(`EventSpace: setup "${setup.id}" has a number in its chalk note; notes are qualitative only.`);
	}
	if (setup.mode === 'compare') validateCompare(setup);
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

/**
 * Compare setups reveal one verdict, so they carry no Check, stages or wrong model. Their weights are fixed fills
 * of one die: each pours exactly 12 units, or P(A) × P(B) wouldn't be a product of probabilities, and each face
 * holds at least 1, so "shares an outcome" and "P(A and B) > 0" always agree.
 */
function validateCompare(setup: Setup): void {
	const name = `EventSpace: compare setup "${setup.id}"`;
	if (setup.wrongModel) throw new Error(`${name} can't show a wrong model; it has no Check to unlock one.`);
	if (setup.stages) throw new Error(`${name} can't offer stages; it has one view.`);
	if (!setup.weightPresets) return;
	if (setup.scenario !== WEIGHABLE_IN_COMPARE) throw new Error(`${name} can weigh only the ${WEIGHABLE_IN_COMPARE} space, not "${setup.scenario}".`);
	if (setup.shrinkSwitch) throw new Error(`EventSpace: setup "${setup.id}" can't combine weights with shrinking; the shrunk readout counts outcomes, not units.`);
	if (!setup.initialWeights) throw new Error(`${name} has weight presets but no initialWeights.`);
	for (const [fill, units] of Object.entries(setup.weightPresets)) {
		const total = units.reduce((sum, unit) => sum + unit, 0);
		if (total !== WEIGHT_TOTAL) throw new Error(`${name} weight preset "${fill}" pours ${total} units; a compare setup needs exactly ${WEIGHT_TOTAL}.`);
		if (units.some((unit) => unit < 1)) throw new Error(`${name} weight preset "${fill}" leaves a face with no units; every face needs at least 1.`);
	}
}

/** Every setup, validated once at import, so a bad one fails the build and renders don't repeat the work. */
const VALIDATED_SETUPS: Readonly<Record<SetupId, Setup>> = Object.freeze(
	Object.fromEntries(Object.entries(SETUPS).map(([id, setup]) => [id, validateSetup(setup)])) as Record<SetupId, Setup>,
);

export function getSetup(id: string): Setup {
	// Own keys only, so "toString" and friends count as unknown rather than reaching Object.prototype.
	if (!Object.hasOwn(VALIDATED_SETUPS, id)) {
		throw new Error(`EventSpace: unknown setup "${id}". Known setups: ${Object.keys(VALIDATED_SETUPS).join(', ')}.`);
	}
	return VALIDATED_SETUPS[id as SetupId];
}
