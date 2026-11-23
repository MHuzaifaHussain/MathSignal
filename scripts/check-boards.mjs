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
const coinsOutcome = (id) => coins.outcomes.find((outcome) => outcome.id === id);
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

// ---- State transitions and copy (EventSpace state.ts and describe.ts) ----
const { initialState, reducer, isLocked } = await import('../src/components/react/eventSpace/state.ts');
const describe = await import('../src/components/react/eventSpace/describe.ts');
const run = (setupId, ...actions) => actions.reduce(reducer, initialState(setupId));
const toggles = (...outcomeIds) => outcomeIds.map((id) => ({ type: 'toggle', id }));

// Status and marked count on the goal setup, before Check: no probability shown.
const fresh = initialState('coins-build');
assert.equal(describe.statusLine(fresh), '4 equally likely outcomes. Event A: at least one head. Tap the squares that belong to A.');
assert.equal(describe.markedLine(run('coins-build', ...toggles('HH', 'HT'))), 'You have marked 2 squares.');
assert.equal(describe.markedLine(run('coins-build', ...toggles('HH'))), 'You have marked 1 square.');
assert.deepEqual(describe.readoutLines(run('coins-build', ...toggles('HH', 'HT', 'TH'))), []);

// Check feedback, word for word.
const passed = run('coins-build', ...toggles('HH', 'HT', 'TH'), { type: 'check' });
assert.equal(describe.feedbackLine(passed), 'Yes: HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75.');
assert.deepEqual(describe.readoutLines(passed), ['A = {HH, HT, TH}. 3 of 4 outcomes. P(A) = 3/4 = 0.75.']);
const mirrorMiss = run('coins-build', ...toggles('HH', 'HT'), { type: 'check' });
assert.equal(describe.feedbackLine(mirrorMiss), 'Not yet. You have HT but not TH. First coin tails, second coin heads is a different way to land from first coin heads, second coin tails.');
assert.equal(describe.missedOutcome(mirrorMiss), 'TH');
assert.equal(describe.feedbackLine(run('coins-build', ...toggles('HH', 'HT', 'TH', 'TT'), { type: 'check' })), 'TT has no head; remove it.');
assert.equal(describe.feedbackLine(run('coins-build', ...toggles('TT'), { type: 'check' })), "You have 0 of the squares A needs, and 1 that don't belong.");
assert.equal(describe.cellName(passed, coinsOutcome('HT')), 'HT. First coin heads, second coin tails. In A.');

// presets locked before Check: a refused action returns the same state object.
assert.equal(isLocked(fresh), true);
assert.equal(reducer(fresh, { type: 'preset', event: 'A', preset: 'at-least-one-head' }), fresh);
assert.equal(isLocked(passed), false);

// reset relocks a goal setup.
const afterReset = reducer(passed, { type: 'reset' });
assert.equal(isLocked(afterReset), true);
assert.equal(afterReset.feedback, null);
assert.equal(afterReset.events.A.size, 0);

// show answer needs two failed checks.
const oneFail = run('coins-build', ...toggles('TT'), { type: 'check' });
assert.equal(reducer(oneFail, { type: 'show-answer' }), oneFail);
const shown = run('coins-build', ...toggles('TT'), { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
assert.equal(shown.checked, true);
assert.deepEqual([...shown.events.A], ['HH', 'HT', 'TH']);

// editing B leaves A alone.
const operations = initialState('dice-operations');
const editedB = run('dice-operations', { type: 'edit', event: 'B' }, { type: 'toggle', id: '1-1' }, { type: 'preset', event: 'B', preset: 'second-6' });
assert.deepEqual([...editedB.events.A], [...operations.events.A]);
assert.equal(editedB.events.A.size, 6);
assert.deepEqual(describe.readoutLines(operations), [
	'A = sum is 7: 6 of 36 = 1/6 (0.17)',
	'B = first die is 6: 6 of 36 = 1/6 (0.17)',
	'not A: 30 of 36',
	'A and B = {(6,1)}: 1 of 36',
	'A or B: 6 + 6 − 1 = 11 of 36 = 0.31',
]);
assert.equal(describe.statusLine(operations), '36 equally likely outcomes. Editing A.');

// pour refusals keep the weights and say why.
const pourFresh = initialState('die-pour');
const refusedIn = reducer(pourFresh, { type: 'pour', id: '3', direction: 1 });
assert.deepEqual(refusedIn.weights, pourFresh.weights);
assert.equal(refusedIn.refusal.reason, 'jug-empty');
assert.equal(describe.refusalText('jug-empty'), 'The jug is empty.');
assert.equal(describe.refusalText('cup-empty'), "A cup can't hold less than nothing.");
const startedOver = reducer(pourFresh, { type: 'weight-preset', name: 'Start over' });
assert.equal(reducer(startedOver, { type: 'pour', id: '3', direction: -1 }).refusal.reason, 'cup-empty');
assert.equal(describe.totalLine(pourFresh), 'All 12 units poured: the cups add up to 1.');
const eightPoured = run('die-pour', ...['1', '2', '3', '4'].map((id) => ({ type: 'pour', id, direction: -1 })));
assert.equal(describe.totalLine(eightPoured), "8 of 12 units poured. The cups add up to 8/12, not 1, so this isn't a probability yet.");
assert.equal(describe.jugLine(eightPoured), 'Jug: 4 of 12 units left.');
assert.equal(describe.additivityLine(pourFresh), 'P(even) = 2/12 + 2/12 + 2/12 = 6/12 = 0.50.');

// Pour buttons know in advance which way is refused, so they can show it before being pressed.
const { pourBlocked } = await import('../src/components/react/eventSpace/state.ts');
assert.equal(pourBlocked(pourFresh, '3', 1), 'jug-empty');
assert.equal(pourBlocked(pourFresh, '3', -1), null);
assert.equal(pourBlocked(startedOver, '3', -1), 'cup-empty');
assert.equal(pourBlocked(startedOver, '3', 1), null);
assert.equal(describe.cupName(pourFresh, die.outcomes[2]), 'Cup 3: 2 of 12 units.');
// With water left in the jug the cups aren't a probability yet, so the sum isn't written as P(...).
assert.equal(describe.additivityLine(eightPoured), 'Even holds 1/12 + 1/12 + 2/12 = 4/12 of the jug.');

console.log('Board check passed.');
