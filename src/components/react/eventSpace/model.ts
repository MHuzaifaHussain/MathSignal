// The math behind EventSpace: outcomes, events as sets, exact fractions, goal checking and pouring.
// Pure TypeScript with no imports, so scripts/check-boards.mjs can run it directly under Node.

export type OutcomeId = string;

export interface Outcome {
	id: OutcomeId;
	row: number;
	col: number;
	/** Short visible label, e.g. "HT" or "3,4". */
	label: string;
	/** Lower-case words for screen readers, e.g. "first coin heads, second coin tails". */
	spoken: string;
}

export interface Fraction {
	numerator: number;
	denominator: number;
}

/** Weights mode pours a jug of 12 units, so halves, thirds, quarters and sixths stay exact. */
export const WEIGHT_TOTAL = 12;

function greatestCommonDivisor(a: number, b: number): number {
	return b === 0 ? Math.abs(a) : greatestCommonDivisor(b, a % b);
}

export function fraction(numerator: number, denominator: number): Fraction {
	if (!(denominator > 0)) throw new Error(`fraction: denominator must be positive, got ${denominator}`);
	if (numerator === 0) return { numerator: 0, denominator: 1 };
	const divisor = greatestCommonDivisor(numerator, denominator);
	return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function formatFraction(value: Fraction): string {
	return value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}

export function intersect(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): ReadonlySet<OutcomeId> {
	return new Set([...a].filter((id) => b.has(id)));
}

export function union(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): ReadonlySet<OutcomeId> {
	return new Set([...a, ...b]);
}

export function complement(a: ReadonlySet<OutcomeId>, all: readonly Outcome[]): ReadonlySet<OutcomeId> {
	return new Set(all.filter((outcome) => !a.has(outcome.id)).map((outcome) => outcome.id));
}

/** Count mode: |E| / |Ω|. Weights mode: the event's units out of the whole jug. */
export function probability(event: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Readonly<Record<OutcomeId, number>>): Fraction {
	if (!weights) return fraction(all.filter((outcome) => event.has(outcome.id)).length, all.length);
	const units = all.reduce((total, outcome) => total + (event.has(outcome.id) ? (weights[outcome.id] ?? 0) : 0), 0);
	return fraction(units, WEIGHT_TOTAL);
}

/**
 * P(A | B) in count mode: the share of B's outcomes that are also in A. Null when B is empty, because
 * conditioning on an event that can't happen is undefined, not zero.
 */
export function conditionalProbability(a: ReadonlySet<OutcomeId>, b: ReadonlySet<OutcomeId>): Fraction | null {
	if (b.size === 0) return null;
	return fraction(intersect(a, b).size, b.size);
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
