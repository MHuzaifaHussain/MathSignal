// The math behind the BayesTheorem board and the scenarios its presets load. Pure TypeScript with no React,
// so scripts/check-boards.mjs can assert the posteriors the pages quote.

export interface BayesValues {
	/** P(A): the prior, drawn as the width of A's column. */
	prior: number;
	/** P(B | A): how often B happens inside A. */
	likelihood: number;
	/** P(B | not A): how often B happens outside A. */
	falsePositive: number;
}

export type BayesScenarioId =
	| 'any-events'
	| 'medical-test'
	| 'wet-lawn'
	| 'late-bus'
	| 'same-chance'
	| 'fraud-flag'
	| 'screening-test'
	| 'screening-clinic';

export interface BayesScenario {
	id: BayesScenarioId;
	/** Preset button text. */
	label: string;
	/** What A and B stand for, shown under the sliders. */
	meaning: string;
	/** What the table counts, plural ("people", "days"): "out of 1,000 people". */
	countNoun: string;
	values: BayesValues;
}

/** The opening view: two unnamed events, so the reader meets the picture before any story. */
export const DEFAULT_SCENARIO: BayesScenarioId = 'any-events';

/** The presets a page gets when it picks none. The published Bayes' theorem page names these three, in this order. */
export const DEFAULT_SCENARIOS: readonly BayesScenarioId[] = ['any-events', 'medical-test', 'wet-lawn'];

/** Plan §5: a board offers 2 to 4 presets, which also keeps the row on one or two lines at 375px. */
export const MIN_PRESETS = 2;
export const MAX_PRESETS = 4;

export const BAYES_SCENARIOS: Readonly<Record<BayesScenarioId, BayesScenario>> = {
	'any-events': {
		id: 'any-events',
		label: 'Any two events',
		meaning: 'A and B are any two events.',
		countNoun: 'trials',
		values: { prior: 0.3, likelihood: 0.8, falsePositive: 0.1 },
	},
	'medical-test': {
		id: 'medical-test',
		label: 'Medical test',
		meaning: 'A: has the condition (1 in 100). B: tests positive. The test is right 9 times in 10 either way.',
		countNoun: 'people',
		values: { prior: 0.01, likelihood: 0.9, falsePositive: 0.1 },
	},
	'wet-lawn': {
		id: 'wet-lawn',
		label: 'Wet lawn',
		meaning: 'A: it rained overnight. B: the lawn is wet. A sprinkler can also wet it when it did not rain.',
		countNoun: 'mornings',
		values: { prior: 0.2, likelihood: 0.9, falsePositive: 0.3 },
	},
	'late-bus': {
		id: 'late-bus',
		label: 'Late bus',
		meaning: 'A: a rainy day (1 in 4). B: the bus is late. It is late 3 times in 10 on rainy days, 1 in 10 on dry days.',
		countNoun: 'days',
		values: { prior: 0.25, likelihood: 0.3, falsePositive: 0.1 },
	},
	'same-chance': {
		id: 'same-chance',
		label: 'Same chance either way',
		meaning: 'A: a rainy day (1 in 4). B: the bus is late. It is late 4 times in 10 on rainy and dry days alike.',
		countNoun: 'days',
		values: { prior: 0.25, likelihood: 0.4, falsePositive: 0.4 },
	},
	'fraud-flag': {
		id: 'fraud-flag',
		label: 'Fraud flag',
		meaning: 'A: a fraud case (4 in 100). B: the model flags it. It flags 80 in 100 fraud cases and 3 in 100 honest ones.',
		countNoun: 'transactions',
		values: { prior: 0.04, likelihood: 0.8, falsePositive: 0.03 },
	},
	'screening-test': {
		id: 'screening-test',
		label: 'Screening test',
		meaning: 'A: has the condition (2 in 100 people screened). B: tests positive. The test catches 95 in 100 who have it and wrongly flags 10 in 100 who don\'t.',
		countNoun: 'people',
		values: { prior: 0.02, likelihood: 0.95, falsePositive: 0.1 },
	},
	'screening-clinic': {
		id: 'screening-clinic',
		label: 'Clinic',
		meaning: 'A: has the condition (30 in 100 patients with symptoms). B: tests positive. The same test: it catches 95 in 100 and wrongly flags 10 in 100.',
		countNoun: 'patients',
		values: { prior: 0.3, likelihood: 0.95, falsePositive: 0.1 },
	},
};

export interface ScenarioChoice {
	/** The preset buttons, in the page's order. */
	scenarios: readonly BayesScenarioId[];
	/** The scenario the board opens on and Reset returns to: `initialScenario`, or else the first preset. Always one of `scenarios`, so it shows as pressed. */
	initial: BayesScenarioId;
}

function toKnownScenario(id: unknown, prop: string): BayesScenarioId {
	if (typeof id === 'string' && Object.hasOwn(BAYES_SCENARIOS, id)) return id as BayesScenarioId;
	const known = Object.keys(BAYES_SCENARIOS).join(', ');
	throw new Error(`BayesTheorem: ${prop} has no example scenario ${JSON.stringify(id)}. Known scenarios: ${known}.`);
}

/**
 * A page's `scenarios` and `initialScenario` props, checked. MDX props aren't type-checked, and the island renders
 * on the server at build time, so an unknown id, an empty, repeated or too-long list, or an opening that isn't one of
 * the presets fails the build here. With neither prop the board keeps its original three presets and opening.
 */
export function resolveScenarios(scenarios?: readonly unknown[], initialScenario?: unknown): ScenarioChoice {
	const list = scenarios === undefined ? DEFAULT_SCENARIOS : scenarios.map((id) => toKnownScenario(id, 'scenarios'));
	if (list.length < MIN_PRESETS || list.length > MAX_PRESETS) {
		throw new Error(`BayesTheorem: scenarios must list ${MIN_PRESETS} to ${MAX_PRESETS} presets, got ${list.length}.`);
	}
	const repeated = list.find((id, index) => list.indexOf(id) !== index);
	if (repeated) throw new Error(`BayesTheorem: scenarios lists "${repeated}" twice.`);
	const initial = initialScenario === undefined ? list[0] : toKnownScenario(initialScenario, 'initialScenario');
	if (!list.includes(initial)) {
		throw new Error(`BayesTheorem: initialScenario "${initial}" must be one of the scenarios (${list.join(', ')}), so Reset can show it as pressed.`);
	}
	return { scenarios: list, initial };
}

/** P(B) by the law of total probability, and P(A | B) by Bayes' theorem. P(B) = 0 has no posterior. */
export function computePosterior({ prior, likelihood, falsePositive }: BayesValues): { evidence: number; posterior: number | null } {
	for (const [name, value] of Object.entries({ prior, likelihood, falsePositive })) {
		if (!(value >= 0 && value <= 1)) throw new Error(`computePosterior: ${name} must be a probability between 0 and 1, got ${value}`);
	}
	const evidence = likelihood * prior + falsePositive * (1 - prior);
	return { evidence, posterior: evidence > 0 ? (likelihood * prior) / evidence : null };
}
