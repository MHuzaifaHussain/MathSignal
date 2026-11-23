// The outcome spaces EventSpace can show, and the named events on each. Board configuration, not shared
// facts, so it lives next to the component rather than in src/data/ (decision 0011).
import type { Outcome, OutcomeId, WrongModelTile } from './model.ts';

export interface EventDefinition {
	/** How the event is named in sentences, e.g. "at least one head". */
	label: string;
	members: (outcome: Outcome) => boolean;
	/** Why an outcome is outside the event, for Check feedback, e.g. "has no head". */
	outsideReason?: string;
}

export type ScenarioId = 'two-coins' | 'one-die' | 'two-dice' | 'kids';

export interface Scenario {
	id: ScenarioId;
	/** Phrase for the grid's accessible name, e.g. "two coin tosses". */
	describeSpace: string;
	/**
	 * 'table' (default): rows and columns are the two parts of an outcome and get headers.
	 * 'list': outcomes are just laid out in rows (a class of children), so there are no headers to read.
	 */
	layout?: 'table' | 'list';
	rowLabel: string;
	colLabel: string;
	rowValues: string[];
	colValues: string[];
	outcomes: Outcome[];
	events: Record<string, EventDefinition>;
	/** The same outcomes in the other order (TH for HT), or undefined when there is no other order. */
	mirrorOf: (id: OutcomeId) => OutcomeId | undefined;
	/** A tempting but wrong way to count this space, shown by re-pooling the reader's tosses. */
	wrongModel?: { switchLabel: string; tiles: WrongModelTile[]; caption: string };
	/** The faces to draw for an outcome in the Pictures view, e.g. ['H', 'T']; absent when pictures don't fit. */
	pictureFaces?: (outcome: Outcome) => string[];
}

const MAX_OUTCOMES = 36;
const COIN_FACES = [
	{ value: 'H', word: 'heads' },
	{ value: 'T', word: 'tails' },
];
const DIE_FACES = ['1', '2', '3', '4', '5', '6'];

function twoCoins(): Scenario {
	const outcomes = COIN_FACES.flatMap((first, row) =>
		COIN_FACES.map((second, col) => ({
			id: `${first.value}${second.value}`,
			row,
			col,
			label: `${first.value}${second.value}`,
			spoken: `first coin ${first.word}, second coin ${second.word}`,
		})),
	);
	const heads = (outcome: Outcome) => [...outcome.id].filter((face) => face === 'H').length;
	return {
		id: 'two-coins',
		describeSpace: 'two coin tosses',
		rowLabel: 'First coin',
		colLabel: 'Second coin',
		rowValues: ['H', 'T'],
		colValues: ['H', 'T'],
		outcomes,
		events: {
			'at-least-one-head': { label: 'at least one head', members: (outcome) => heads(outcome) >= 1, outsideReason: 'has no head' },
			'exactly-one-head': { label: 'exactly one head', members: (outcome) => heads(outcome) === 1 },
			'both-same': { label: 'both the same', members: (outcome) => outcome.id[0] === outcome.id[1] },
		},
		mirrorOf: (id) => (id[0] === id[1] ? undefined : `${id[1]}${id[0]}`),
		pictureFaces: (outcome) => [...outcome.id],
		wrongModel: {
			switchLabel: 'Treat HT and TH as the same outcome',
			tiles: [
				{ label: 'HH', members: ['HH'] },
				{ label: 'one of each', members: ['HT', 'TH'] },
				{ label: 'TT', members: ['TT'] },
			],
			caption: 'If these 3 were equally likely, at least one head would be 2/3.',
		},
	};
}

function oneDie(): Scenario {
	const outcomes = DIE_FACES.map((face, col) => ({ id: face, row: 0, col, label: face, spoken: `${face}` }));
	return {
		id: 'one-die',
		describeSpace: 'one roll of a die',
		rowLabel: 'Die',
		colLabel: 'Face',
		rowValues: [''],
		colValues: DIE_FACES,
		outcomes,
		events: {
			even: { label: 'even', members: (outcome) => Number(outcome.id) % 2 === 0 },
			'at-most-2': { label: 'at most 2', members: (outcome) => Number(outcome.id) <= 2 },
			six: { label: 'six', members: (outcome) => outcome.id === '6' },
		},
		mirrorOf: () => undefined,
	};
}

function twoDice(): Scenario {
	const outcomes = DIE_FACES.flatMap((first, row) =>
		DIE_FACES.map((second, col) => ({
			id: `${first}-${second}`,
			row,
			col,
			label: `${first},${second}`,
			spoken: `first die ${first}, second die ${second}`,
		})),
	);
	const faces = (outcome: Outcome) => outcome.id.split('-').map(Number);
	const sum = (outcome: Outcome) => faces(outcome)[0] + faces(outcome)[1];
	return {
		id: 'two-dice',
		describeSpace: 'two dice',
		rowLabel: 'First die',
		colLabel: 'Second die',
		rowValues: DIE_FACES,
		colValues: DIE_FACES,
		outcomes,
		events: {
			'sum-7': { label: 'sum is 7', members: (outcome) => sum(outcome) === 7 },
			'sum-2': { label: 'sum is 2', members: (outcome) => sum(outcome) === 2 },
			'sum-at-least-10': { label: 'sum is at least 10', members: (outcome) => sum(outcome) >= 10 },
			double: { label: 'a double', members: (outcome) => faces(outcome)[0] === faces(outcome)[1] },
			'first-6': { label: 'first die is 6', members: (outcome) => faces(outcome)[0] === 6 },
			'second-6': { label: 'second die is 6', members: (outcome) => faces(outcome)[1] === 6 },
		},
		mirrorOf: (id) => {
			const [first, second] = id.split('-');
			return first === second ? undefined : `${second}-${first}`;
		},
	};
}

/** What each child in the class wears: 5 hats, 2 of them with a scarf, and 4 scarves in all. */
const KIDS_WEAR: readonly { hat: boolean; scarf: boolean }[] = [
	{ hat: true, scarf: false },
	{ hat: true, scarf: true },
	{ hat: false, scarf: false },
	{ hat: false, scarf: true },
	{ hat: false, scarf: false },
	{ hat: true, scarf: false },
	{ hat: true, scarf: true },
	{ hat: false, scarf: false },
	{ hat: false, scarf: false },
	{ hat: true, scarf: false },
	{ hat: false, scarf: true },
	{ hat: false, scarf: false },
];
const KIDS_PER_ROW = 4;

function wearWords(wear: { hat: boolean; scarf: boolean }): string {
	if (wear.hat && wear.scarf) return 'hat and scarf';
	if (wear.hat) return 'hat';
	if (wear.scarf) return 'scarf';
	return 'no hat or scarf';
}

function kids(): Scenario {
	if (KIDS_WEAR.length % KIDS_PER_ROW !== 0) {
		// A short last row would leave grid slots with no cell, and the roving focus could land on one.
		throw new Error(`EventSpace: the class of ${KIDS_WEAR.length} children doesn't fill rows of ${KIDS_PER_ROW}.`);
	}
	const wearById = new Map<OutcomeId, { hat: boolean; scarf: boolean }>();
	const outcomes = KIDS_WEAR.map((wear, index) => {
		const id = `child-${index + 1}`;
		wearById.set(id, wear);
		return {
			id,
			row: Math.floor(index / KIDS_PER_ROW),
			col: index % KIDS_PER_ROW,
			label: String(index + 1),
			// The label already says the child's number, and the grid's name says these are children.
			spoken: wearWords(wear),
		};
	});
	const wearOf = (outcome: Outcome) => {
		const wear = wearById.get(outcome.id);
		if (!wear) throw new Error(`EventSpace: "${outcome.id}" is not a child in the class.`);
		return wear;
	};
	const rowCount = KIDS_WEAR.length / KIDS_PER_ROW;
	return {
		id: 'kids',
		describeSpace: `a class of ${KIDS_WEAR.length} children, one picked at random`,
		layout: 'list',
		rowLabel: 'Row',
		colLabel: 'Seat',
		rowValues: Array.from({ length: rowCount }, (_, row) => String(row + 1)),
		colValues: Array.from({ length: KIDS_PER_ROW }, (_, col) => String(col + 1)),
		outcomes,
		events: {
			scarf: { label: 'wears a scarf', members: (outcome) => wearOf(outcome).scarf },
			hat: { label: 'wears a hat', members: (outcome) => wearOf(outcome).hat },
		},
		mirrorOf: () => undefined,
	};
}

function checked(scenario: Scenario): Scenario {
	if (scenario.outcomes.length > MAX_OUTCOMES) {
		throw new Error(`EventSpace: scenario "${scenario.id}" has ${scenario.outcomes.length} outcomes; the most a board can show is ${MAX_OUTCOMES}.`);
	}
	return scenario;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
	'two-coins': checked(twoCoins()),
	'one-die': checked(oneDie()),
	'two-dice': checked(twoDice()),
	kids: checked(kids()),
};

/** The ids of a scenario's named event, in outcome order. */
export function eventMembers(scenario: Scenario, eventId: string): ReadonlySet<OutcomeId> {
	const definition = scenario.events[eventId];
	if (!definition) throw new Error(`EventSpace: scenario "${scenario.id}" has no event "${eventId}".`);
	return new Set(scenario.outcomes.filter(definition.members).map((outcome) => outcome.id));
}
