// Checks the pure logic behind the interactive boards (math, copy, state transitions) with node:assert,
// before every build. Node 24 runs the TypeScript modules directly, so no test framework is needed.
// Each section names the behavior it pins; the exact values come from the board's design doc.
import assert from 'node:assert/strict';
import { fraction, formatFraction, addFractions, multiplyFractions, compareFractions, toNumber } from '../src/components/react/boardMath.ts';
import { joinWords, plural, equalsDecimal } from '../src/components/react/boardText.ts';
import { probability, checkGoal, pour, intersect, union, complement, WEIGHT_TOTAL } from '../src/components/react/eventSpace/model.ts';
import { SCENARIOS } from '../src/components/react/eventSpace/scenarios.ts';
import { getSetup } from '../src/components/react/eventSpace/setups.ts';
import { distributionOf, distributionFromPmf, mean, variance, standardDeviation, torqueSign, classifyGuess } from '../src/components/react/distributionBoard/model.ts';

// ---- Shared board helpers ----

assert.deepEqual(addFractions(fraction(1, 6), fraction(1, 3)), fraction(1, 2));
assert.deepEqual(multiplyFractions(fraction(5, 6), fraction(6, 5)), fraction(1, 1));
assert.equal(compareFractions(fraction(7, 6), fraction(1, 1)), 1);
assert.equal(compareFractions(fraction(2, 4), fraction(1, 2)), 0);
assert.throws(() => multiplyFractions(fraction(2 ** 30, 1), fraction(2 ** 30, 1)), /overflowed safe integers/);
assert.equal(toNumber(fraction(1, 4)), 0.25);
assert.deepEqual(addFractions(fraction(0, 1), fraction(1, 3)), fraction(1, 3));
assert.throws(() => addFractions(fraction(1, 2 ** 30), fraction(1, 2 ** 30 - 1)), /overflowed safe integers/);
assert.equal(joinWords(['1', '2', '3']), '1, 2 and 3');
assert.equal(plural(1, 'candy', 'candies'), '1 candy');
assert.equal(equalsDecimal(1, 6), '≈ 0.17');
assert.equal(equalsDecimal(1, 2), '= 0.50');

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
assert.equal(describe.feedbackLine(run('coins-build', ...toggles('TT'), { type: 'check' })), "You have 0 of the squares A needs, and 1 that doesn't belong.");
assert.equal(describe.feedbackLine(run('coins-build', ...toggles('HH', 'TT'), { type: 'check' })), "You have 1 of the squares A needs, and 1 that doesn't belong.");
// No goal setup today has two wrong squares to mark, so the plural is pinned on a built feedback value.
assert.equal(describe.feedbackLine({ ...fresh, feedback: { kind: 'partial', found: 1, needed: 3, wrong: 2 } }), "You have 1 of the squares A needs, and 2 that don't belong.");
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
// A shown answer isn't praised with "Yes".
assert.equal(describe.feedbackLine(shown), 'The answer: HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75.');
assert.equal(describe.announcementFor(shown, { type: 'show-answer' }), 'The answer: HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75.');

// editing B leaves A alone.
const operations = initialState('dice-operations');
const editedB = run('dice-operations', { type: 'edit', event: 'B' }, { type: 'toggle', id: '1-1' }, { type: 'preset', event: 'B', preset: 'second-6' });
assert.deepEqual([...editedB.events.A], [...operations.events.A]);
assert.equal(editedB.events.A.size, 6);
assert.deepEqual(describe.readoutLines(operations), [
	'A = sum is 7: 6 of 36 = 1/6 (≈ 0.17)',
	'B = first die is 6: 6 of 36 = 1/6 (≈ 0.17)',
	'not A: 30 of 36',
	'A and B = {(6,1)}: 1 of 36',
	'A or B: 6 + 6 − 1 = 11 of 36 ≈ 0.31',
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
// A pour naming a cup the die doesn't have changes nothing.
assert.equal(reducer(startedOver, { type: 'pour', id: '7', direction: 1 }), startedOver);
// The pour announcement agrees in number ("1 unit", "2 units").
const onePoured = run('die-pour', { type: 'pour', id: '1', direction: -1 });
assert.equal(describe.announcementFor(onePoured, { type: 'pour', id: '1', direction: -1 }), 'Cup 1: 1 of 12 units. 1 unit left in the jug.');
assert.equal(describe.announcementFor(reducer(onePoured, { type: 'pour', id: '2', direction: -1 }), { type: 'pour', id: '2', direction: -1 }), 'Cup 2: 1 of 12 units. 2 units left in the jug.');
// With water left in the jug the cups aren't a probability yet, so the sum isn't written as P(...).
assert.equal(describe.additivityLine(eightPoured), 'Even holds 1/12 + 1/12 + 2/12 = 4/12 of the jug.');

// ---- Tosses and the wrong three-outcome model (v1.1) ----
const model = await import('../src/components/react/eventSpace/model.ts');
const cycling = () => { let index = 0; const values = [0, 0.25, 0.5, 0.75]; return () => values[index++ % values.length]; };
const batch = model.simulate(coins.outcomes, 100, cycling());
assert.deepEqual(batch, { HH: 25, HT: 25, TH: 25, TT: 25 });
assert.deepEqual(model.poolTiles(batch, coins.wrongModel.tiles), [
	{ label: 'HH', count: 25 },
	{ label: 'one of each', count: 50 },
	{ label: 'TT', count: 25 },
]);
assert.equal(coins.wrongModel.caption, 'If these 3 were equally likely, at least one head would be 2/3.');

// Tosses and the wrong model stay locked until Check passes, so they can't give the answer away.
assert.equal(reducer(fresh, { type: 'toss', results: batch }), fresh);
assert.equal(reducer(fresh, { type: 'wrong-model', on: true }), fresh);
const tossedTwice = [{ type: 'toss', results: batch }, { type: 'toss', results: batch }].reduce(reducer, passed);
assert.equal(tossedTwice.tossCount, 200);
assert.deepEqual(tossedTwice.tallies, { HH: 50, HT: 50, TH: 50, TT: 50 });
assert.equal(describe.tossLine(tossedTwice), 'Tossed 200 times: at least one head 150 times (0.75). Your count says 0.75.');
const uneven = reducer(passed, { type: 'toss', results: { HH: 49, HT: 52, TH: 50, TT: 49 } });
assert.equal(describe.tossLine(uneven), 'Tossed 200 times: at least one head 151 times (≈ 0.76). Your count says 0.75.');
assert.equal(describe.announcementFor(uneven, { type: 'toss', results: {} }), 'Tossed 200 times in all. At least one head 151 times, ≈ 0.76.');
assert.equal(describe.cellName(tossedTwice, coinsOutcome('HT')), 'HT. First coin heads, second coin tails. In A. Tossed 50 times.');
assert.equal(describe.tossLine(passed), null);
assert.equal(reducer(passed, { type: 'wrong-model', on: true }).wrongModel, true);
assert.equal(reducer(initialState('dice-count'), { type: 'wrong-model', on: true }).wrongModel, false);
// Reset clears tosses too.
assert.equal(reducer(tossedTwice, { type: 'reset' }).tossCount, 0);

// ---- Stages: pictures, letters, sets (v1.1) ----
const setsView = reducer(passed, { type: 'stage', stage: 'sets' });
assert.equal(describe.setsLine(setsView), 'Ω = {HH, HT, TH, TT}. A = {HH, HT, TH}. P(A) = |A| / |Ω| = 3/4');
assert.equal(describe.setsLine(passed), null); // only in the Sets view
const lockedSets = reducer(fresh, { type: 'stage', stage: 'sets' });
assert.equal(lockedSets.stage, 'sets'); // the view can be chosen before Check…
assert.equal(describe.setsLine(lockedSets), null); // …but the symbolic line waits for Check
assert.equal(reducer(fresh, { type: 'stage', stage: 'picture' }).stage, 'picture');
const diceFresh = initialState('dice-count');
assert.equal(reducer(diceFresh, { type: 'stage', stage: 'picture' }), diceFresh); // no stages on dice-count
const { stageAllowed } = await import('../src/components/react/eventSpace/state.ts');
assert.equal(stageAllowed(diceFresh, 'picture'), false);
assert.equal(stageAllowed(fresh, 'picture'), true); // the 4 coin outcomes are few enough to draw
// The view change is announced by the name on its button.
assert.equal(describe.announcementFor(reducer(fresh, { type: 'stage', stage: 'picture' }), { type: 'stage', stage: 'picture' }), 'Showing pictures.');

// ---- Final review fixes ----
// Critical: after Check passes, changing A clears the "Yes" so the board never approves a wrong event.
assert.equal(describe.feedbackLine(reducer(passed, { type: 'toggle', id: 'TH' })), null);
assert.equal(describe.feedbackLine(reducer(passed, { type: 'preset', event: 'A', preset: 'both-same' })), null);
// A second wrong Check says the answer can now be shown, so it isn't a silent repeat.
const twoFails = run('coins-build', ...toggles('TT'), { type: 'check' }, { type: 'check' });
assert.equal(describe.announcementFor(twoFails, { type: 'check' }), "You have 0 of the squares A needs, and 1 that doesn't belong. You can now show the answer.");
assert.equal(describe.announcementFor(oneFail, { type: 'check' }), "You have 0 of the squares A needs, and 1 that doesn't belong.");
// Weight presets fail loudly when they can't be a jug of 12.
const { validateSetup } = await import('../src/components/react/eventSpace/setups.ts');
const pourSetup = getSetup('die-pour');
assert.throws(() => validateSetup({ ...pourSetup, initialWeights: 'Fair dice' }), /initialWeights "Fair dice"/);
assert.throws(() => validateSetup({ ...pourSetup, weightPresets: { Short: [2, 2, 2] } }), /"Short" has 3 cups/);
assert.throws(() => validateSetup({ ...pourSetup, weightPresets: { Over: [3, 3, 3, 3, 3, 3] } }), /"Over" pours 18 units/);
assert.throws(() => validateSetup({ ...pourSetup, weightPresets: { Bad: [2, 2, 2, 2, 2.5, -0.5] } }), /"Bad" needs whole numbers of units/);

// ---- Conditioning: shrink the world to B (v1.2) ----
const kids = SCENARIOS.kids;
assert.equal(kids.outcomes.length, 12);
assert.equal(ids(kids, 'hat').size, 5);
assert.equal(ids(kids, 'scarf').size, 4);
assert.equal(intersect(ids(kids, 'hat'), ids(kids, 'scarf')).size, 2);
assert.deepEqual(model.conditionalProbability(ids(kids, 'scarf'), ids(kids, 'hat')), fraction(2, 5));
assert.deepEqual(model.conditionalProbability(ids(dice, 'sum-at-least-10'), ids(dice, 'double')), fraction(1, 3));
assert.equal(model.conditionalProbability(ids(dice, 'sum-7'), new Set()), null); // undefined, not 0

const conditionFresh = initialState('dice-condition');
assert.equal(describe.statusLine(conditionFresh), '36 equally likely outcomes. Editing A.');
assert.deepEqual(describe.readoutLines(conditionFresh), [
	'A = sum is at least 10: 6 of 36 = 1/6 (≈ 0.17)',
	'B = doubles: 6 of 36 = 1/6 (≈ 0.17)',
	'A and B = {(5,5), (6,6)}: 2 of 36',
]);
const shrunk = reducer(conditionFresh, { type: 'shrink', on: true });
const shrunkLine = 'Inside B: 6 outcomes, 2 of them also in A, {(5,5), (6,6)}. P(A | B) = 2/6 = 1/3 ≈ 0.33, while P(A) = 6/36 = 1/6 ≈ 0.17.';
assert.deepEqual(describe.readoutLines(shrunk), [shrunkLine]);
assert.equal(describe.statusLine(shrunk), '36 equally likely outcomes. Editing A. Shrunk to B: 6 outcomes left.');
// Speech matches the screen while shrunk: a change to A or B is announced as the new P(A | B).
const shrunkToggle = reducer(shrunk, { type: 'toggle', id: '4-4' });
assert.equal(describe.announcementFor(shrunkToggle, { type: 'toggle', id: '4-4' }), 'Inside B: 6 outcomes, 3 of them also in A, {(4,4), (5,5), (6,6)}. P(A | B) = 3/6 = 1/2 = 0.50, while P(A) = 7/36 ≈ 0.19.');
const shrunkPreset = reducer(shrunk, { type: 'preset', event: 'A', preset: 'clear' });
assert.equal(describe.announcementFor(shrunkPreset, { type: 'preset', event: 'A', preset: 'clear' }), 'Inside B: 6 outcomes, none of them also in A. P(A | B) = 0/6 = 0, while P(A) = 0/36 = 0.');
// A setup that would need unbuilt conditioning features fails loudly.
const conditionSetup = getSetup('dice-condition');
assert.throws(() => validateSetup({ ...conditionSetup, events: { A: conditionSetup.events.A } }), /needs an event B/);
assert.throws(() => validateSetup({ ...conditionSetup, toss: true }), /can't toss yet/);
assert.throws(() => validateSetup({ ...conditionSetup, lookAt: true }), /can't use "Look at"/);
// A goal setup keeps its "missed" outline free: no "Look at" strike or shrinking drawn over it.
const goalSetup = getSetup('coins-build');
assert.throws(() => validateSetup({ ...goalSetup, lookAt: true }), /goal setup "coins-build" can't use "Look at" or conditioning/);
assert.throws(() => validateSetup({ ...conditionSetup, goal: 'double' }), /goal setup "dice-condition"/);
assert.equal(describe.cellName(shrunk, dice.outcomes[1]), '1,2. First die 1, second die 2. Ruled out.');
assert.equal(describe.cellName(shrunk, dice.outcomes[0]), '1,1. First die 1, second die 1. In B.');
assert.equal(describe.announcementFor(reducer(shrunk, { type: 'shrink', on: false }), { type: 'shrink', on: false }), 'Back to all outcomes.');

// Conditioning on an empty B is refused, before and after shrinking, and says why.
const noB = run('dice-condition', { type: 'preset', event: 'B', preset: 'clear' });
const refusedShrink = reducer(noB, { type: 'shrink', on: true });
assert.equal(refusedShrink.shrink, false);
assert.equal(describe.announcementFor(refusedShrink, { type: 'shrink', on: true }), "Undefined: B can't happen (probability 0).");
const emptiedWhileShrunk = reducer(shrunk, { type: 'preset', event: 'B', preset: 'clear' });
assert.equal(emptiedWhileShrunk.shrink, false);
assert.equal(emptiedWhileShrunk.shrinkRefused, true);
assert.equal(describe.announcementFor(emptiedWhileShrunk, { type: 'preset', event: 'B', preset: 'clear' }), "Undefined: B can't happen (probability 0).");
// Shrinking only exists in condition mode, and Reset un-shrinks.
assert.equal(reducer(operations, { type: 'shrink', on: true }), operations);
assert.equal(reducer(shrunk, { type: 'reset' }).shrink, false);

// The class of children is fixed data: named in the status line, not editable.
const kidsFresh = initialState('kids-condition');
assert.equal(describe.statusLine(kidsFresh), '12 equally likely outcomes. A: wears a scarf. B: wears a hat.');
assert.equal(reducer(kidsFresh, { type: 'toggle', id: 'child-1' }), kidsFresh);
assert.deepEqual(describe.readoutLines(reducer(kidsFresh, { type: 'shrink', on: true })), [
	'Inside B: 5 outcomes, 2 of them also in A, {2, 7}. P(A | B) = 2/5 = 0.40, while P(A) = 4/12 = 1/3 ≈ 0.33.',
]);
assert.equal(describe.cellName(kidsFresh, kids.outcomes[1]), '2. Hat and scarf. In A and B.');

// ---- BayesTheorem scenarios (week 2 presets) ----
const bayes = await import('../src/components/react/bayesTheorem/scenarios.ts');
const posteriorOf = (id) => bayes.computePosterior(bayes.BAYES_SCENARIOS[id].values);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} is not ${expected}`);
// Medical test: 1 in 100 has the condition, the test is right 9 times in 10. A positive means only 1/12 ≈ 0.083.
near(posteriorOf('medical-test').evidence, 0.108);
near(posteriorOf('medical-test').posterior, 1 / 12);
// Wet lawn: P(rain) = 0.2, P(wet | rain) = 0.9, P(wet | no rain) = 0.3 gives 0.18 / 0.42 = 3/7 ≈ 0.429.
near(posteriorOf('wet-lawn').evidence, 0.42);
near(posteriorOf('wet-lawn').posterior, 3 / 7);
near(posteriorOf('any-events').posterior, 0.24 / 0.31);
assert.equal(bayes.BAYES_SCENARIOS[bayes.DEFAULT_SCENARIO].id, 'any-events');
// Every scenario sits on the sliders' 0.01 grid inside their range, so loading one never clamps a value.
for (const scenario of Object.values(bayes.BAYES_SCENARIOS)) {
	for (const value of Object.values(scenario.values)) {
		assert.ok(value >= 0.01 && value <= 0.99 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, `${scenario.id}: ${value} is off the slider grid`);
	}
}
// P(B) = 0 has no posterior, and impossible inputs fail loudly.
assert.equal(bayes.computePosterior({ prior: 0.5, likelihood: 0, falsePositive: 0 }).posterior, null);
assert.throws(() => bayes.computePosterior({ prior: 1.2, likelihood: 0.5, falsePositive: 0.5 }), /prior must be a probability/);

// ---- DistributionBoard model ----

const weighted = (outcomes) => outcomes.map(({ id, label, spoken }) => ({ id, label, spoken, weight: 1 }));
const oneDie = weighted(SCENARIOS['one-die'].outcomes);
const twoCoins = weighted(SCENARIOS['two-coins'].outcomes);
const dieDistribution = (values) => distributionOf(oneDie, Object.fromEntries(values.map((value, index) => [String(index + 1), value])));
const coinDistribution = (values) => distributionOf(twoCoins, Object.fromEntries(values.map((value, index) => [twoCoins[index].id, value])));

// Every preset's mean and variance, exact (the table in the design).
const presets = [
	['Game card', dieDistribution([0, 0, 0, 1, 1, 5]), fraction(7, 6), fraction(113, 36)],
	['Plain die', dieDistribution([1, 2, 3, 4, 5, 6]), fraction(7, 2), fraction(35, 12)],
	['One big prize', dieDistribution([0, 0, 0, 0, 0, 6]), fraction(1, 1), fraction(5, 1)],
	['Lopsided', dieDistribution([0, 0, 0, 1, 1, 4]), fraction(1, 1), fraction(2, 1)],
	['All win 1', dieDistribution([1, 1, 1, 1, 1, 1]), fraction(1, 1), fraction(0, 1)],
	['Steady', dieDistribution([2, 2, 2, 2, 2, 2]), fraction(2, 1), fraction(0, 1)],
	['Many amounts', dieDistribution([1, 1, 2, 2, 3, 3]), fraction(2, 1), fraction(2, 3)],
	['All or nothing', dieDistribution([0, 0, 0, 4, 4, 4]), fraction(2, 1), fraction(4, 1)],
	['Number of heads', coinDistribution([2, 1, 1, 0]), fraction(1, 1), fraction(1, 2)],
	['Coins match', coinDistribution([1, 0, 0, 1]), fraction(1, 2), fraction(1, 4)],
];
for (const [name, distribution, expectedMean, expectedVariance] of presets) {
	assert.deepEqual(mean(distribution), expectedMean, `${name}: mean`);
	assert.deepEqual(variance(distribution), expectedVariance, `${name}: variance`);
}
assert.equal(standardDeviation(dieDistribution([0, 0, 0, 0, 0, 6])), Math.sqrt(5));
assert.equal(standardDeviation(dieDistribution([2, 2, 2, 2, 2, 2])), 0);

// The merge: faces that share a value become one bar, bars sorted by value, members in outcome order.
const gameCard = dieDistribution([0, 0, 0, 1, 1, 5]);
assert.deepEqual(gameCard.bars.map((bar) => bar.value), [0, 1, 5]);
assert.deepEqual(gameCard.bars.map((bar) => bar.members), [['1', '2', '3'], ['4', '5'], ['6']]);
assert.deepEqual(gameCard.bars.map((bar) => bar.probability), [fraction(1, 2), fraction(1, 3), fraction(1, 6)]);
assert.equal(gameCard.totalWeight, 6);
assert.deepEqual(dieDistribution([5, 0, 5, 0, 1, 0]).bars.map((bar) => bar.value), [0, 1, 5]);
assert.throws(() => distributionOf(oneDie, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }), /no value for outcome "6"/);

// Weights: a loaded die moves the mean and the variance.
const weightedDie = oneDie.map((outcome) => ({ ...outcome, weight: outcome.id === '6' ? 7 : 1 }));
const loadedDie = distributionOf(weightedDie, { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 });
assert.deepEqual(mean(loadedDie), fraction(19, 4));
assert.deepEqual(variance(loadedDie), fraction(145, 48));

// A distribution entered directly (week 5), with no outcomes behind it.
const entered = distributionFromPmf([{ value: 0, weight: 1 }, { value: 1, weight: 2 }, { value: 2, weight: 1 }]);
assert.deepEqual(mean(entered), fraction(1, 1));
assert.deepEqual(variance(entered), fraction(1, 2));
assert.deepEqual(entered.bars.map((bar) => bar.members), [[], [], []]);
assert.throws(() => distributionFromPmf([]), /no weight/);

// Torque: positive when the balance point is right of the pencil, so the plank tips down on the right.
const oneBigPrize = dieDistribution([0, 0, 0, 0, 0, 6]);
assert.equal(torqueSign(oneBigPrize, 0, 6), 1);
assert.equal(torqueSign(oneBigPrize, 18, 6), -1);
assert.equal(torqueSign(oneBigPrize, 6, 6), 0);
assert.equal(torqueSign(oneBigPrize, -3, 6), 1);

// Guess classification on One big prize (mean 1, midpoint 3, tallest bar at 0).
assert.equal(classifyGuess(oneBigPrize, 0, 6), 'tallest-bar');
assert.equal(classifyGuess(oneBigPrize, 18, 6), 'midrange');
assert.equal(classifyGuess(oneBigPrize, 6, 6), 'balanced');
assert.equal(classifyGuess(oneBigPrize, 3, 6), 'other');
assert.equal(classifyGuess(oneBigPrize, -3, 6), 'other');
assert.equal(torqueSign(oneBigPrize, -3, 6), 1);
assert.equal(classifyGuess(oneBigPrize, 36, 6), 'other');
assert.equal(torqueSign(oneBigPrize, 36, 6), -1);

// Plain die is symmetric: the midpoint is the mean, so the midrange note never applies.
const plainDie = dieDistribution([1, 2, 3, 4, 5, 6]);
assert.equal(classifyGuess(plainDie, 21, 6), 'balanced');
for (let k = -3; k <= 36; k += 1) assert.notEqual(classifyGuess(plainDie, k, 6), 'midrange', `plain die k=${k}`);

// A tie for the tallest bar means no tallest-bar note.
const tiedBars = dieDistribution([0, 0, 6, 6, 1, 1]);
for (let k = -3; k <= 36; k += 1) assert.notEqual(classifyGuess(tiedBars, k, 6), 'tallest-bar', `tied bars k=${k}`);

// The tallest bar at the mean is just balance, and a bad pencil fails loudly.
assert.equal(classifyGuess(dieDistribution([2, 2, 2, 2, 0, 4]), 12, 6), 'balanced');
assert.throws(() => torqueSign(plainDie, 1.5, 6), /integer/);
assert.throws(() => torqueSign(plainDie, 1, 0), /positive/);

// ---- DistributionBoard setups and state ----
const distSetups = await import('../src/components/react/distributionBoard/setups.ts');
const dist = await import('../src/components/react/distributionBoard/state.ts');
const distRun = (setupId, ...actions) => actions.reduce(dist.reducer, dist.initialState(setupId));
const faceValues = (values) => Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
/** Steps each die face from 0 up to its target value. */
const stepsTo = (values) => values.flatMap((value, index) => Array.from({ length: value }, () => ({ type: 'step', id: String(index + 1), direction: 1 })));

// Setup validation names the setup and the cause.
assert.throws(() => distSetups.getSetup('candy-bild'), /unknown setup "candy-bild"/);
const candyBuild = distSetups.getSetup('candy-build');
const candyBalance = distSetups.getSetup('candy-balance');
assert.throws(
	() => distSetups.validateSetup({ ...candyBalance, presets: ['Plain die', 'One big prize', 'Lopsided', 'All win 1', 'Game card'] }),
	/"candy-balance".*5 presets/,
);
assert.throws(
	() => distSetups.validateSetup({ ...candyBalance, presets: ['Too high'] }, { ...distSetups.PRESETS, 'Too high': [0, 0, 0, 0, 0, 7] }),
	/"candy-balance".*"Too high".*7.*0\.\.6/,
);
assert.throws(
	() => distSetups.validateSetup({ ...candyBalance, presets: ['Short'] }, { ...distSetups.PRESETS, Short: [1, 2, 3, 4, 5] }),
	/"candy-balance".*"Short".*5 values.*6 outcomes/,
);
assert.throws(() => distSetups.validateSetup({ ...candyBalance, opening: [1, 2, 3, 4, 5] }), /"candy-balance".*opening.*5 values.*6 outcomes/);
assert.throws(
	() => distSetups.validateSetup({ ...candyBalance, stepDenominator: 4, presets: ['Plain die', 'Game card'] }),
	/"candy-balance".*"Game card".*7\/6.*4/,
);
// Every built-in setup passes, and "All zero" fits both the die and the coins.
for (const id of ['candy-build', 'coins-heads', 'candy-balance', 'candy-spread']) assert.equal(distSetups.getSetup(id).id, id);
assert.deepEqual(distSetups.presetValues(distSetups.getSetup('coins-heads'), 'All zero'), [0, 0, 0, 0]);
assert.deepEqual(distSetups.presetValues(candyBuild, 'All zero'), [0, 0, 0, 0, 0, 0]);
assert.throws(() => distSetups.validateSetup({ ...candyBuild, card: undefined }), /"candy-build".*card/);
assert.throws(() => distSetups.validateSetup({ ...candyBuild, card: [0, 0, 0, 1, 1, 9] }), /"candy-build".*card.*9.*0\.\.6/);
assert.throws(() => distSetups.validateSetup({ ...candyBuild, range: [0, 7] }), /"candy-build".*8 tile columns/);
assert.throws(
	() => distSetups.validateSetup({ ...distSetups.getSetup('candy-spread'), presets: ['One big prize'] }),
	/"candy-spread".*"One big prize".*off the axis/,
);
assert.throws(() => distSetups.validateSetup({ ...candyBalance, stepDenominator: 3, presets: ['One big prize'], opening: [0, 0, 0, 0, 0, 6] }), /"candy-balance".*even/);
assert.equal(candyBuild.wording.valueText(1), '1 candy');
assert.equal(candyBuild.wording.valueText(0), '0 candies');
assert.equal(candyBuild.wording.raiseName('4'), 'More candies for face 4');
assert.equal(candyBuild.wording.lowerName('4'), 'Fewer candies for face 4');
assert.equal(distSetups.getSetup('coins-heads').wording.valueText(1), 'X = 1');
assert.equal(distSetups.getSetup('coins-heads').wording.raiseName('HT'), 'Raise X for HT');

// The covered chart: Check uncovers it only when the values match the card.
const buildFresh = dist.initialState('candy-build');
assert.equal(dist.isCovered(buildFresh), true);
assert.deepEqual(buildFresh.values, faceValues([0, 0, 0, 0, 0, 0]));
const cardMatched = distRun('candy-build', ...stepsTo([0, 0, 0, 1, 1, 5]), { type: 'check' });
assert.equal(dist.isCovered(cardMatched), false);
assert.equal(cardMatched.feedback.kind, 'match');
assert.equal(cardMatched.goal, 'open');
assert.deepEqual(dist.distributionNow(cardMatched).bars.map((bar) => bar.members), [['1', '2', '3'], ['4', '5'], ['6']]);
const oneWrong = distRun('candy-build', ...stepsTo([0, 0, 0, 1, 1, 4]), { type: 'check' });
assert.deepEqual(oneWrong.feedback, { kind: 'one-wrong', id: '6', set: 4, card: 5 });
assert.equal(dist.isCovered(oneWrong), true);
const threeWrong = distRun('candy-build', { type: 'check' });
assert.deepEqual(threeWrong.feedback, { kind: 'several-wrong', ids: ['4', '5', '6'] });
// A value change clears stale feedback.
assert.equal(dist.reducer(threeWrong, { type: 'step', id: '1', direction: 1 }).feedback, null);

// "Show the answer" needs two failed Checks.
const oneFailed = distRun('candy-build', { type: 'check' });
assert.equal(dist.reducer(oneFailed, { type: 'show-answer' }), oneFailed);
const answerShown = distRun('candy-build', { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
assert.deepEqual(answerShown.values, faceValues([0, 0, 0, 1, 1, 5]));
assert.equal(answerShown.feedback.kind, 'shown');
assert.equal(dist.isCovered(answerShown), false);

// A refused step leaves the values and says why.
const belowRange = dist.reducer(buildFresh, { type: 'step', id: '1', direction: -1 });
assert.deepEqual(belowRange.values, buildFresh.values);
assert.deepEqual(belowRange.refusal, { kind: 'below-range', id: '1' });
const atTop = distRun('candy-build', ...stepsTo([6, 0, 0, 0, 0, 0]));
const aboveRange = dist.reducer(atTop, { type: 'step', id: '1', direction: 1 });
assert.deepEqual(aboveRange.values, atTop.values);
assert.equal(aboveRange.refusal.kind, 'above-range');
assert.equal(dist.stepBlocked(atTop, '1', 1), 'above-range');
assert.equal(dist.reducer(aboveRange, { type: 'step', id: '1', direction: -1 }).refusal, null);

// Presets wait for the match on goal setups; Symbols too.
assert.equal(dist.reducer(buildFresh, { type: 'preset', name: 'Game card' }).refusal.kind, 'locked');
assert.deepEqual(dist.reducer(buildFresh, { type: 'preset', name: 'Game card' }).values, buildFresh.values);
assert.equal(dist.reducer(buildFresh, { type: 'stage', stage: 'symbols' }), buildFresh);
assert.equal(dist.stageAllowed(buildFresh, 'symbols'), false);
assert.equal(dist.stageAllowed(buildFresh, 'pictures'), true);
assert.equal(dist.reducer(cardMatched, { type: 'stage', stage: 'symbols' }).stage, 'symbols');
assert.equal(dist.reducer(cardMatched, { type: 'preset', name: 'All zero' }).activePreset, 'All zero');

// The follow-up goal on candy-build: exactly 3 faces at 1, retryable forever. coins-heads has none.
const goalFrom = (values) => dist.reducer({ ...cardMatched, values: faceValues(values) }, { type: 'check-goal' });
assert.equal(goalFrom([1, 0, 1, 0, 1, 5]).goal, 'passed');
const goalMissed = goalFrom([0, 0, 0, 1, 1, 5]);
assert.equal(goalMissed.goal, 'not-yet');
const goalRetried = [{ type: 'step', id: '1', direction: 1 }, { type: 'check-goal' }].reduce(dist.reducer, goalMissed);
assert.equal(goalRetried.goal, 'passed');
assert.equal(dist.reducer(goalRetried, { type: 'step', id: '2', direction: 1 }).goal, 'open');
assert.equal(dist.reducer(buildFresh, { type: 'check-goal' }), buildFresh);
const coinsMatched = distRun('coins-heads', { type: 'step', id: 'HH', direction: 1 }, { type: 'step', id: 'HH', direction: 1 }, { type: 'step', id: 'HT', direction: 1 }, { type: 'step', id: 'TH', direction: 1 }, { type: 'check' });
assert.equal(coinsMatched.feedback.kind, 'match');
assert.equal(coinsMatched.goal, null);
assert.equal(dist.initialState('coins-heads').pencil, -2);

// The pencil on candy-balance: Balance it is refused while parked, and steps wait for the reveal.
const balanceFresh = dist.initialState('candy-balance');
assert.equal(balanceFresh.pencil, -3);
assert.equal(dist.PARKED, -0.5);
assert.equal(balanceFresh.activePreset, 'Plain die');
assert.equal(balanceFresh.revealed, false);
const parkedBalance = dist.reducer(balanceFresh, { type: 'balance' });
assert.equal(parkedBalance.refusal.kind, 'parked');
assert.equal(parkedBalance.revealed, false);
assert.equal(dist.reducer(balanceFresh, { type: 'step', id: '1', direction: 1 }).refusal.kind, 'locked');
assert.deepEqual(dist.reducer(balanceFresh, { type: 'step', id: '1', direction: 1 }).values, balanceFresh.values);
const pencilMoved = dist.reducer(balanceFresh, { type: 'pencil', k: 21 });
assert.deepEqual({ ...pencilMoved, pencil: balanceFresh.pencil }, balanceFresh);
const balanced = dist.reducer(pencilMoved, { type: 'balance' });
assert.equal(balanced.revealed, true);
assert.equal(balanced.refusal, null);
const editedAfterReveal = dist.reducer(balanced, { type: 'step', id: '1', direction: 1 });
assert.equal(editedAfterReveal.values['1'], 2);
assert.equal(editedAfterReveal.refusal, null);
assert.equal(editedAfterReveal.activePreset, null);
// The pencil clamps to its track, from −W/2 to 6W.
assert.equal(dist.reducer(balanceFresh, { type: 'pencil', k: -10 }).pencil, -3);
assert.equal(dist.reducer(balanceFresh, { type: 'pencil', k: 99 }).pencil, 36);
assert.equal(dist.reducer(buildFresh, { type: 'pencil', k: 6 }), buildFresh);
assert.equal(dist.reducer(buildFresh, { type: 'balance' }), buildFresh);
// A preset re-parks the pencil and re-hides μ.
const newGame = dist.reducer(balanced, { type: 'preset', name: 'One big prize' });
assert.equal(newGame.revealed, false);
assert.equal(newGame.pencil, -3);
assert.equal(newGame.activePreset, 'One big prize');
assert.deepEqual(newGame.values, faceValues([0, 0, 0, 0, 0, 6]));

// candy-spread: the ghost keeps the previous preset's σ, never the same preset's.
const spreadOn = dist.reducer(dist.initialState('candy-spread'), { type: 'spread', on: true });
assert.equal(spreadOn.revealed, true);
assert.equal(spreadOn.activePreset, 'Many amounts');
assert.equal(distRun('candy-spread', { type: 'spread', on: true }, { type: 'preset', name: 'Many amounts' }, { type: 'preset', name: 'Many amounts' }).ghost, null);
const ghosted = [{ type: 'preset', name: 'Many amounts' }, { type: 'preset', name: 'All or nothing' }].reduce(dist.reducer, spreadOn);
assert.equal(ghosted.ghost.preset, 'Many amounts');
assert.ok(Math.abs(ghosted.ghost.sigma - 0.8165) < 1e-4, `ghost sigma ${ghosted.ghost.sigma}`);
assert.equal(dist.reducer(dist.initialState('candy-spread'), { type: 'preset', name: 'All or nothing' }).ghost, null);
assert.equal(dist.reducer(ghosted, { type: 'spread', on: false }).ghost, null);
for (const id of ['1', '2', '3', '4', '5', '6']) {
	for (const direction of [1, -1]) {
		const refused = dist.reducer(spreadOn, { type: 'step', id, direction });
		assert.equal(refused.refusal.kind, 'not-editable', `step ${direction} on face ${id}`);
		assert.deepEqual(refused.values, spreadOn.values);
	}
}
assert.equal(dist.reducer(spreadOn, { type: 'stage', stage: 'symbols' }), spreadOn);
assert.equal(dist.reducer(spreadOn, { type: 'check' }), spreadOn);

// Reset returns the opening state exactly.
assert.deepEqual(dist.reducer(cardMatched, { type: 'reset' }), dist.initialState('candy-build'));
assert.deepEqual(dist.reducer(balanced, { type: 'reset' }), dist.initialState('candy-balance'));
assert.deepEqual(dist.reducer(ghosted, { type: 'reset' }), dist.initialState('candy-spread'));

console.log('Board check passed.');
