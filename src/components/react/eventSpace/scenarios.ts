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

export type ScenarioId = 'two-coins' | 'one-die' | 'two-dice' | 'coin-die' | 'kids' | 'weather-days' | 'monty-hall';

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
			'first-head': { label: 'first coin is heads', members: (outcome) => outcome.id[0] === 'H' },
			'two-heads': { label: 'two heads', members: (outcome) => heads(outcome) === 2 },
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
	// "Face 3", so a cell reads "3. Face 3." rather than "3. 3.".
	const outcomes = DIE_FACES.map((face, col) => ({ id: face, row: 0, col, label: face, spoken: `face ${face}` }));
	return {
		id: 'one-die',
		describeSpace: 'one roll of a die',
		layout: 'list',
		rowLabel: 'Row',
		colLabel: 'Face',
		rowValues: ['1'],
		colValues: DIE_FACES,
		outcomes,
		events: {
			even: { label: 'even', members: (outcome) => Number(outcome.id) % 2 === 0 },
			'at-most-2': { label: 'at most 2', members: (outcome) => Number(outcome.id) <= 2 },
			six: { label: 'six', members: (outcome) => outcome.id === '6' },
			'at-least-4': { label: 'at least 4', members: (outcome) => Number(outcome.id) >= 4 },
			'five-or-six': { label: '5 or 6', members: (outcome) => Number(outcome.id) >= 5 },
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
			'sum-8': { label: 'sum is 8', members: (outcome) => sum(outcome) === 8 },
			'sum-2': { label: 'sum is 2', members: (outcome) => sum(outcome) === 2 },
			'sum-at-least-10': { label: 'sum is at least 10', members: (outcome) => sum(outcome) >= 10 },
			double: { label: 'doubles', members: (outcome) => faces(outcome)[0] === faces(outcome)[1] },
			'first-6': { label: 'first die is 6', members: (outcome) => faces(outcome)[0] === 6 },
			'second-6': { label: 'second die is 6', members: (outcome) => faces(outcome)[1] === 6 },
		},
		mirrorOf: (id) => {
			const [first, second] = id.split('-');
			return first === second ? undefined : `${second}-${first}`;
		},
	};
}

/** A coin flipped beside a die: 12 outcomes, H1 to T6, where neither part can affect the other. */
function coinDie(): Scenario {
	const outcomes = COIN_FACES.flatMap((coin, row) =>
		DIE_FACES.map((face, col) => ({
			id: `${coin.value}${face}`,
			row,
			col,
			label: `${coin.value}${face}`,
			spoken: `coin ${coin.word}, die ${face}`,
		})),
	);
	const coinOf = (outcome: Outcome) => outcome.id[0];
	const faceOf = (outcome: Outcome) => Number(outcome.id.slice(1));
	return {
		id: 'coin-die',
		describeSpace: 'a coin flip and a die roll',
		rowLabel: 'Coin',
		colLabel: 'Die',
		rowValues: COIN_FACES.map((coin) => coin.value),
		colValues: DIE_FACES,
		outcomes,
		events: {
			heads: { label: 'coin is heads', members: (outcome) => coinOf(outcome) === 'H' },
			tails: { label: 'coin is tails', members: (outcome) => coinOf(outcome) === 'T' },
			'die-6': { label: 'die is 6', members: (outcome) => faceOf(outcome) === 6 },
			'die-even': { label: 'die is even', members: (outcome) => faceOf(outcome) % 2 === 0 },
			'heads-and-six': { label: 'heads and a six', members: (outcome) => coinOf(outcome) === 'H' && faceOf(outcome) === 6 },
		},
		mirrorOf: () => undefined,
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

interface FixedListSpec<Item> {
	id: ScenarioId;
	describeSpace: string;
	/** Outcome ids are this prefix and the item's number, e.g. "child-3". */
	idPrefix: string;
	items: readonly Item[];
	perRow: number;
	/** The words after the item's number in its cell's name, e.g. "hat and scarf". */
	spokenOf: (item: Item) => string;
	events: Record<string, { label: string; has: (item: Item) => boolean }>;
}

/**
 * Fixed data, such as a class of children: numbered items laid out in rows with no headers, because rows and
 * columns mean nothing. Each item's facts are looked up by its outcome id.
 */
function fixedList<Item>({ id, describeSpace, idPrefix, items, perRow, spokenOf, events }: FixedListSpec<Item>): Scenario {
	if (items.length % perRow !== 0) {
		// A short last row would leave grid slots with no cell, and the roving focus could land on one.
		throw new Error(`EventSpace: scenario "${id}" has ${items.length} items, which don't fill rows of ${perRow}.`);
	}
	const itemById = new Map<OutcomeId, Item>();
	const outcomes = items.map((item, index) => {
		const outcomeId = `${idPrefix}-${index + 1}`;
		itemById.set(outcomeId, item);
		return {
			id: outcomeId,
			row: Math.floor(index / perRow),
			col: index % perRow,
			label: String(index + 1),
			// The label already says the item's number, and the grid's name says what the items are.
			spoken: spokenOf(item),
		};
	});
	const itemOf = (outcome: Outcome) => {
		const item = itemById.get(outcome.id);
		if (item === undefined) throw new Error(`EventSpace: "${outcome.id}" is not an item of scenario "${id}".`);
		return item;
	};
	return {
		id,
		describeSpace,
		layout: 'list',
		rowLabel: 'Row',
		colLabel: 'Column',
		rowValues: Array.from({ length: items.length / perRow }, (_, row) => String(row + 1)),
		colValues: Array.from({ length: perRow }, (_, col) => String(col + 1)),
		outcomes,
		events: Object.fromEntries(
			Object.entries(events).map(([eventId, { label, has }]) => [eventId, { label, members: (outcome: Outcome) => has(itemOf(outcome)) }]),
		),
		mirrorOf: () => undefined,
	};
}

function kids(): Scenario {
	return fixedList({
		id: 'kids',
		describeSpace: `a class of ${KIDS_WEAR.length} children, one picked at random`,
		idPrefix: 'child',
		items: KIDS_WEAR,
		perRow: KIDS_PER_ROW,
		spokenOf: wearWords,
		events: {
			scarf: { label: 'wears a scarf', has: (wear) => wear.scarf },
			hat: { label: 'wears a hat', has: (wear) => wear.hat },
		},
	});
}

/**
 * The weather on 12 days of one spring. Each day has exactly one kind, so "rain all day" and "sun all day" can't
 * both happen: the pair is mutually exclusive by construction.
 */
type DayWeather = 'rain' | 'sun' | 'mixed';
const SPRING_DAYS: readonly DayWeather[] = ['mixed', 'rain', 'sun', 'mixed', 'sun', 'rain', 'mixed', 'sun', 'mixed', 'rain', 'sun', 'mixed'];
const DAYS_PER_ROW = 4;
const WEATHER_WORDS: Readonly<Record<DayWeather, string>> = { rain: 'rain all day', sun: 'sun all day', mixed: 'sun and showers' };

function weatherDays(): Scenario {
	return fixedList({
		id: 'weather-days',
		describeSpace: `${SPRING_DAYS.length} days from one spring, one day picked at random`,
		idPrefix: 'day',
		items: SPRING_DAYS,
		perRow: DAYS_PER_ROW,
		spokenOf: (day) => WEATHER_WORDS[day],
		events: {
			'rain-all-day': { label: 'rain all day', has: (day) => day === 'rain' },
			'sun-all-day': { label: 'sun all day', has: (day) => day === 'sun' },
			'some-rain': { label: 'some rain', has: (day) => day !== 'sun' },
			'some-sun': { label: 'some sun', has: (day) => day !== 'rain' },
		},
	});
}

/** The doors the car can be behind; you always pick door 1, so the host opens door 2 or door 3. */
const MONTY_CAR_DOORS = [1, 2, 3] as const;
const MONTY_COIN = COIN_FACES.map((face) => ({ ...face, opensOnTie: face.value === 'H' ? 2 : 3 }));

/**
 * The door the host opens: never your door 1 and never the car's door. Only with the car behind door 1 does he
 * have a choice, and then the coin decides (heads door 2, tails door 3): his 50/50 tie-break.
 */
function montyOpens(car: number, coin: (typeof MONTY_COIN)[number]): number {
	if (car === 1) return coin.opensOnTie;
	return car === 2 ? 3 : 2;
}

/**
 * The Monty Hall game as six equally likely cells, (car's door) × (host's coin), each 1/3 × 1/2 = 1/6. The coin
 * column turns the host's 50/50 tie-break into equally likely outcomes, so conditioning stays a count.
 */
function montyHall(): Scenario {
	const opensById = new Map<OutcomeId, number>();
	const outcomes = MONTY_CAR_DOORS.flatMap((car, row) =>
		MONTY_COIN.map((coin, col) => {
			const id = `${car}-${coin.value}`;
			const opens = montyOpens(car, coin);
			opensById.set(id, opens);
			return { id, row, col, label: `opens ${opens}`, spoken: `car behind door ${car}, coin ${coin.word}`, setLabel: `car ${car}, ${coin.word}` };
		}),
	);
	const carOf = (outcome: Outcome) => Number(outcome.id.split('-')[0]);
	const opensOf = (outcome: Outcome) => {
		const door = opensById.get(outcome.id);
		if (door === undefined) throw new Error(`EventSpace: "${outcome.id}" is not a Monty Hall game.`);
		return door;
	};
	return {
		id: 'monty-hall',
		describeSpace: 'the Monty Hall game, where you pick door 1',
		rowLabel: 'Car behind',
		colLabel: "Host's coin",
		rowValues: MONTY_CAR_DOORS.map((car) => `door ${car}`),
		colValues: MONTY_COIN.map((coin) => coin.word),
		outcomes,
		events: {
			'car-1': { label: 'car behind door 1', members: (outcome) => carOf(outcome) === 1 },
			'car-2': { label: 'car behind door 2', members: (outcome) => carOf(outcome) === 2 },
			'car-3': { label: 'car behind door 3', members: (outcome) => carOf(outcome) === 3 },
			'opens-3': { label: 'host opens door 3', members: (outcome) => opensOf(outcome) === 3 },
			'opens-2': { label: 'host opens door 2', members: (outcome) => opensOf(outcome) === 2 },
		},
		mirrorOf: () => undefined,
	};
}

/** Whether any row header is a phrase ("door 1") rather than a single symbol ("H", "3"); such headers must not wrap. */
export function hasWordedRowHeaders(scenario: Scenario): boolean {
	return scenario.rowValues.some((value) => value.includes(' '));
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
	'coin-die': checked(coinDie()),
	kids: checked(kids()),
	'weather-days': checked(weatherDays()),
	'monty-hall': checked(montyHall()),
};

/** The ids of a scenario's named event, in outcome order. */
export function eventMembers(scenario: Scenario, eventId: string): ReadonlySet<OutcomeId> {
	const definition = scenario.events[eventId];
	if (!definition) throw new Error(`EventSpace: scenario "${scenario.id}" has no event "${eventId}".`);
	return new Set(scenario.outcomes.filter(definition.members).map((outcome) => outcome.id));
}
