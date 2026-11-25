// The math behind EventSpace: outcomes, events as sets, goal checking and pouring. Pure TypeScript that imports
// only the shared fraction helpers, so scripts/check-boards.mjs can run it directly under Node.
import { compareFractions, fraction, multiplyFractions, type Fraction } from '../boardMath.ts';

export type OutcomeId = string;

export interface Outcome {
	id: OutcomeId;
	row: number;
	col: number;
	/** Short visible label, e.g. "HT" or "3,4". */
	label: string;
	/** Lower-case words for screen readers, e.g. "first coin heads, second coin tails". */
	spoken: string;
	/**
	 * The outcome's name in set lists, when cells share a visible label: three Monty Hall cells read "opens 3",
	 * so the shrunk readout lists them as "(car 2, heads)". Absent when the label is already unique.
	 */
	setLabel?: string;
}

/** Weights mode pours a jug of 12 units, so halves, thirds, quarters and sixths stay exact. */
export const WEIGHT_TOTAL = 12;

export function intersect(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): ReadonlySet<OutcomeId> {
	return new Set([...a].filter((id) => b.has(id)));
}

export function union(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): ReadonlySet<OutcomeId> {
	return new Set([...a, ...b]);
}

export function complement(a: ReadonlySet<OutcomeId>, all: readonly Outcome[]): ReadonlySet<OutcomeId> {
	return new Set(all.filter((outcome) => !a.has(outcome.id)).map((outcome) => outcome.id));
}

export type Weights = Readonly<Record<OutcomeId, number>>;

/** How much of the space an event holds: its outcomes counted, or its units when the outcomes are weighted. */
export function eventSize(event: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Weights): number {
	return all.reduce((total, outcome) => total + (event.has(outcome.id) ? unitsOf(outcome.id, weights) : 0), 0);
}

/** One outcome's units, or 1 when the outcomes are equally likely. A weighted outcome with no units given is a bug. */
function unitsOf(id: OutcomeId, weights: Weights | undefined): number {
	if (!weights) return 1;
	const units = weights[id];
	if (units === undefined) throw new Error(`EventSpace: outcome "${id}" has no weight; every weighted outcome needs one.`);
	return units;
}

/** Count mode: |E| / |Ω|. Weights mode: the event's units out of the whole jug. */
export function probability(event: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Weights): Fraction {
	return fraction(eventSize(event, all, weights), weights ? WEIGHT_TOTAL : all.length);
}

/**
 * P(A | B): the share of B's outcomes (or of B's units, when weighted) that also lie in A. Null when B can't
 * happen, because conditioning on an impossible event is undefined, not zero.
 */
export function weightedConditional(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Weights): Fraction | null {
	const sizeOfB = eventSize(b, all, weights);
	if (sizeOfB === 0) return null;
	return fraction(eventSize(intersect(a, b), all, weights), sizeOfB);
}

/** P(A | B) on equally likely outcomes; see weightedConditional. */
export function conditionalProbability(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): Fraction | null {
	if (b.size === 0) return null;
	return fraction(intersect(a, b).size, b.size);
}

export interface EventComparison {
	pA: Fraction;
	pB: Fraction;
	pBoth: Fraction;
	product: Fraction;
	/** P(A | B), or null when B can't happen. */
	given: Fraction | null;
	/** P(A ∩ B) = P(A) P(B), compared exactly, so an event of probability 0 is independent of every event. */
	independent: boolean;
	/** A and B share no outcome: a fact about the sets, whatever the probabilities. */
	exclusive: boolean;
}

/**
 * Independence and mutual exclusivity of two events. Independence uses only the product form (Grinstead and
 * Snell, Theorem 4.1), in exact integer arithmetic that throws rather than overflow, so no rounding decides it.
 */
export function compareEvents(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Weights): EventComparison {
	const pA = probability(a, all, weights);
	const pB = probability(b, all, weights);
	const both = intersect(a, b);
	const pBoth = probability(both, all, weights);
	const product = multiplyFractions(pA, pB);
	return {
		pA,
		pB,
		pBoth,
		product,
		given: weightedConditional(a, b, all, weights),
		independent: compareFractions(pBoth, product) === 0,
		exclusive: both.size === 0,
	};
}

export type GoalResult =
	| { kind: 'correct' }
	| { kind: 'missed-mirror'; have: OutcomeId; missing: OutcomeId }
	| { kind: 'extra'; extra: OutcomeId[] }
	| { kind: 'partial'; found: number; needed: number; wrong: number };

/**
 * Compares the reader's marked outcomes with the goal event and names the most useful mistake: a missing
 * outcome whose mirror (TH for HT) is marked comes first, because that is the misconception the board targets.
 * Ids are compared in the goal set's and the marked set's insertion order, which follows outcome order.
 */
export function checkGoal(marked: ReadonlySet<OutcomeId>, goal: ReadonlySet<OutcomeId>, mirrorOf: (id: OutcomeId) => OutcomeId | undefined): GoalResult {
	const missing = [...goal].filter((id) => !marked.has(id));
	const extra = [...marked].filter((id) => !goal.has(id));
	if (missing.length === 0 && extra.length === 0) return { kind: 'correct' };
	if (extra.length === 0) {
		const firstMissing = missing[0];
		const mirror = mirrorOf(firstMissing);
		if (missing.every((id) => { const other = mirrorOf(id); return other !== undefined && marked.has(other); }) && mirror !== undefined) {
			return { kind: 'missed-mirror', have: mirror, missing: firstMissing };
		}
	}
	if (missing.length === 0) return { kind: 'extra', extra };
	return { kind: 'partial', found: goal.size - missing.length, needed: goal.size, wrong: extra.length };
}

export type PourResult = { ok: true; weights: Record<OutcomeId, number> } | { ok: false; reason: 'cup-empty' | 'jug-empty' };

/** Moves one unit between the jug and a cup. Refuses rather than letting a cup or the jug go below zero. */
export function pour(weights: Readonly<Record<OutcomeId, number>>, id: OutcomeId, direction: 1 | -1): PourResult {
	const current = weights[id] ?? 0;
	const poured = Object.values(weights).reduce((total, units) => total + units, 0);
	if (direction === -1 && current === 0) return { ok: false, reason: 'cup-empty' };
	if (direction === 1 && poured >= WEIGHT_TOTAL) return { ok: false, reason: 'jug-empty' };
	return { ok: true, weights: { ...weights, [id]: current + direction } };
}

/**
 * Tosses `count` times, each outcome equally likely, and returns how often each one came up. `random` is
 * passed in (Math.random on the page) so this stays pure and checkable.
 */
export function simulate(all: readonly Outcome[], count: number, random: () => number): Record<OutcomeId, number> {
	const tallies: Record<OutcomeId, number> = Object.fromEntries(all.map((outcome) => [outcome.id, 0]));
	for (let toss = 0; toss < count; toss += 1) {
		const outcome = all[Math.min(Math.floor(random() * all.length), all.length - 1)];
		tallies[outcome.id] += 1;
	}
	return tallies;
}

/** One tile of a wrong model that lumps outcomes together, such as "one of each" for HT and TH. */
export interface WrongModelTile {
	label: string;
	members: OutcomeId[];
}

/** Re-pools real tallies into the wrong model's tiles, so the reader's own tosses show it is wrong. */
export function poolTiles(tallies: Readonly<Record<OutcomeId, number>>, tiles: readonly WrongModelTile[]): { label: string; count: number }[] {
	return tiles.map((tile) => ({ label: tile.label, count: tile.members.reduce((total, id) => total + (tallies[id] ?? 0), 0) }));
}
