// Checks the pure logic behind the interactive boards (math, copy, state transitions) with node:assert,
// before every build. Node 24 runs the TypeScript modules directly, so no test framework is needed.
// Each section names the behavior it pins; the exact values come from the board's design doc.
import assert from 'node:assert/strict';
import { fraction, formatFraction, probability, checkGoal, pour, intersect, union, complement, WEIGHT_TOTAL } from '../src/components/react/eventSpace/model.ts';
import { SCENARIOS } from '../src/components/react/eventSpace/scenarios.ts';
import { getSetup } from '../src/components/react/eventSpace/setups.ts';

const coins = SCENARIOS['two-coins'];
const dice = SCENARIOS['two-dice'];
const die = SCENARIOS['one-die'];
const ids = (scenario, event) => new Set(scenario.outcomes.filter(scenario.events[event].members).map((outcome) => outcome.id));

// Fractions are reduced and refuse a zero denominator.
assert.deepEqual(fraction(6, 36), { numerator: 1, denominator: 6 });
assert.equal(formatFraction(fraction(3, 4)), '3/4');
assert.equal(formatFraction(fraction(0, 4)), '0');
assert.throws(() => fraction(1, 0));

// Outcome spaces are ordered: HT and TH are different outcomes.
assert.deepEqual(coins.outcomes.map((outcome) => outcome.label), ['HH', 'HT', 'TH', 'TT']);
assert.equal(coins.outcomes[2].spoken, 'first coin tails, second coin heads');
assert.equal(dice.outcomes.length, 36);
assert.equal(coins.mirrorOf('HT'), 'TH');

// The probabilities the pages state.
assert.deepEqual(probability(ids(coins, 'at-least-one-head'), coins.outcomes), fraction(3, 4));
assert.deepEqual(probability(ids(dice, 'sum-7'), dice.outcomes), fraction(6, 36));
assert.deepEqual(probability(ids(dice, 'sum-2'), dice.outcomes), fraction(1, 36));
const sum7 = ids(dice, 'sum-7');
const first6 = ids(dice, 'first-6');
assert.equal(intersect(sum7, first6).size, 1);
assert.equal(union(sum7, first6).size, 11);
assert.equal(complement(sum7, dice.outcomes).size, 30);
assert.deepEqual(probability(ids(die, 'even'), die.outcomes, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 }), fraction(6, 12));

// Check names the specific mistake.
const goal = ids(coins, 'at-least-one-head');
assert.deepEqual(checkGoal(new Set(['HH', 'HT', 'TH']), goal, coins.mirrorOf), { kind: 'correct' });
assert.deepEqual(checkGoal(new Set(['HH', 'HT']), goal, coins.mirrorOf), { kind: 'missed-mirror', have: 'HT', missing: 'TH' });
assert.deepEqual(checkGoal(new Set(['HH', 'HT', 'TH', 'TT']), goal, coins.mirrorOf), { kind: 'extra', extra: ['TT'] });
assert.deepEqual(checkGoal(new Set(['TT']), goal, coins.mirrorOf), { kind: 'partial', found: 0, needed: 3, wrong: 1 });

// Pour refusals: no cup below zero, nothing poured from an empty jug.
const emptyCups = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
assert.deepEqual(pour(emptyCups, '3', -1), { ok: false, reason: 'cup-empty' });
const fairDie = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 };
assert.deepEqual(pour(fairDie, '3', 1), { ok: false, reason: 'jug-empty' });
assert.deepEqual(pour(fairDie, '3', -1), { ok: true, weights: { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2, 6: 2 } });
assert.equal(WEIGHT_TOTAL, 12);

// A typo in a page's setup fails loudly.
assert.throws(() => getSetup('coins-bild'), /unknown setup "coins-bild"/);
assert.equal(getSetup('coins-build').goal, 'at-least-one-head');

console.log('Board check passed.');
