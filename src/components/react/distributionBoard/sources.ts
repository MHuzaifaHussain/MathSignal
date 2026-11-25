// The outcome lists DistributionBoard maps to numbers. They come from EventSpace's scenarios so a die face or a
// coin outcome is spelled the same on both boards; this is the only DistributionBoard module that imports them.
import { SCENARIOS } from '../eventSpace/scenarios.ts';
import type { WeightedOutcome } from './model.ts';

export type SourceId = 'one-die' | 'two-coins';

/** Every source is a fair one for now, so each outcome carries the same weight. */
const EQUAL_WEIGHT = 1;

function equallyLikely(source: SourceId): readonly WeightedOutcome[] {
	return SCENARIOS[source].outcomes.map(({ id, label, spoken }) => ({ id, label, spoken, weight: EQUAL_WEIGHT }));
}

const SOURCES: Readonly<Record<SourceId, readonly WeightedOutcome[]>> = {
	'one-die': equallyLikely('one-die'),
	'two-coins': equallyLikely('two-coins'),
};

/** An outcome that can't happen would draw a tile with no chance behind it, so every weight is at least 1. */
export function assertPossible(source: string, outcomes: readonly WeightedOutcome[]): readonly WeightedOutcome[] {
	const impossible = outcomes.find((outcome) => !Number.isSafeInteger(outcome.weight) || outcome.weight < 1);
	if (impossible) throw new Error(`DistributionBoard: source "${source}" gives outcome "${impossible.id}" weight ${impossible.weight}; every weight must be a whole number of at least 1.`);
	return outcomes;
}

export function outcomesOf(source: SourceId): readonly WeightedOutcome[] {
	const outcomes = SOURCES[source];
	if (!outcomes) throw new Error(`DistributionBoard: unknown source "${source}". Known sources: ${Object.keys(SOURCES).join(', ')}.`);
	return assertPossible(source, outcomes);
}
