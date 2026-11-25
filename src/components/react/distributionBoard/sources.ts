// The outcome lists DistributionBoard maps to numbers. They come from EventSpace's scenarios so a die face or a
// coin outcome is spelled the same on both boards; this is the only DistributionBoard module that imports them.
import { COIN_FACES, SCENARIOS } from '../eventSpace/scenarios.ts';
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

/** Coin lists short enough to print every sequence; longer ones are counted with C(n, k) instead. */
export const MAX_LISTED_COINS = 3;
const ORDINALS = ['first', 'second', 'third'] as const;

export interface CoinSequence extends WeightedOutcome {
	heads: number;
}

/**
 * Every sequence of n fair coins (n = 1..3), in the order EventSpace lists two coins: HHH, HHT, HTH, …, TTT. Labels
 * are "HHT"; spoken forms follow the two-coin pattern ("first coin heads, second coin heads, third coin tails"), and
 * one coin is just "heads" or "tails".
 */
export function coinSequences(n: number): readonly CoinSequence[] {
	if (!Number.isInteger(n) || n < 1 || n > MAX_LISTED_COINS) {
		throw new Error(`coinSequences: n must be a whole number from 1 to ${MAX_LISTED_COINS}, got ${n}`);
	}
	let sequences: (typeof COIN_FACES)[number][][] = [[]];
	for (let coin = 0; coin < n; coin += 1) sequences = sequences.flatMap((start) => COIN_FACES.map((face) => [...start, face]));
	return assertPossible(`${n} coins`, sequences.map((faces) => {
		const label = faces.map((face) => face.value).join('');
		const spoken = n === 1 ? faces[0].word : faces.map((face, index) => `${ORDINALS[index]} coin ${face.word}`).join(', ');
		return { id: label, label, spoken, weight: EQUAL_WEIGHT, heads: faces.filter((face) => face.value === 'H').length };
	})) as readonly CoinSequence[];
}
