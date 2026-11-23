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

export type BayesScenarioId = 'any-events' | 'medical-test' | 'wet-lawn';

export interface BayesScenario {
	id: BayesScenarioId;
	/** Preset button text. */
	label: string;
	/** What A and B stand for, shown under the sliders. */
	meaning: string;
	values: BayesValues;
}

/** The opening view: two unnamed events, so the reader meets the picture before any story. */
export const DEFAULT_SCENARIO: BayesScenarioId = 'any-events';

export const BAYES_SCENARIOS: Readonly<Record<BayesScenarioId, BayesScenario>> = {
	'any-events': {
		id: 'any-events',
		label: 'Any two events',
		meaning: 'A and B are any two events.',
		values: { prior: 0.3, likelihood: 0.8, falsePositive: 0.1 },
	},
	'medical-test': {
		id: 'medical-test',
		label: 'Medical test',
		meaning: 'A: has the condition (1 in 100). B: tests positive. The test is right 9 times in 10 either way.',
		values: { prior: 0.01, likelihood: 0.9, falsePositive: 0.1 },
	},
	'wet-lawn': {
		id: 'wet-lawn',
		label: 'Wet lawn',
		meaning: 'A: it rained overnight. B: the lawn is wet. A sprinkler can also wet it when it did not rain.',
		values: { prior: 0.2, likelihood: 0.9, falsePositive: 0.3 },
	},
};

/** P(B) by the law of total probability, and P(A | B) by Bayes' theorem. P(B) = 0 has no posterior. */
export function computePosterior({ prior, likelihood, falsePositive }: BayesValues): { evidence: number; posterior: number | null } {
	for (const [name, value] of Object.entries({ prior, likelihood, falsePositive })) {
		if (!(value >= 0 && value <= 1)) throw new Error(`computePosterior: ${name} must be a probability between 0 and 1, got ${value}`);
	}
	const evidence = likelihood * prior + falsePositive * (1 - prior);
	return { evidence, posterior: evidence > 0 ? (likelihood * prior) / evidence : null };
}
