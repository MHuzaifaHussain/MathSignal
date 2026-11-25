// Checks the pure logic behind the interactive boards (math, copy, state transitions) with node:assert,
// before every build. Node 24 runs the TypeScript modules directly, so no test framework is needed.
// Each section names the behavior it pins; the exact values come from the board's design doc.
import assert from 'node:assert/strict';
import { fraction, formatFraction, addFractions, multiplyFractions, compareFractions, toNumber, isPerfectSquare, squareRoot } from '../src/components/react/boardMath.ts';
import { joinWords, plural, equalsDecimal } from '../src/components/react/boardText.ts';
import { probability, checkGoal, pour, intersect, union, complement, WEIGHT_TOTAL } from '../src/components/react/eventSpace/model.ts';
import { SCENARIOS, hasWordedRowHeaders } from '../src/components/react/eventSpace/scenarios.ts';
import { getSetup } from '../src/components/react/eventSpace/setups.ts';
import { distributionOf, distributionFromPmf, mean, variance, standardDeviation, torqueSign, classifyGuess } from '../src/components/react/distributionBoard/model.ts';

// ---- Shared board helpers ----

assert.deepEqual(addFractions(fraction(1, 6), fraction(1, 3)), fraction(1, 2));
assert.deepEqual(multiplyFractions(fraction(5, 6), fraction(6, 5)), fraction(1, 1));
assert.equal(compareFractions(fraction(7, 6), fraction(1, 1)), 1);
assert.equal(compareFractions(fraction(2, 4), fraction(1, 2)), 0);
assert.throws(() => multiplyFractions(fraction(2 ** 30, 1), fraction(2 ** 30, 1)), /overflowed safe integers/);
assert.throws(() => compareFractions(fraction(2 ** 30, 2 ** 30 - 1), fraction(2 ** 30 + 1, 2 ** 30)), /overflowed safe integers/);
assert.equal(toNumber(fraction(1, 4)), 0.25);
assert.deepEqual(addFractions(fraction(0, 1), fraction(1, 3)), fraction(1, 3));
assert.throws(() => addFractions(fraction(1, 2 ** 30), fraction(1, 2 ** 30 - 1)), /overflowed safe integers/);
// A square root is exact only when the fraction is a square of a fraction; otherwise it is a float to round.
assert.equal(isPerfectSquare(64), true);
assert.equal(isPerfectSquare(0), true);
assert.equal(isPerfectSquare(72), false);
assert.equal(isPerfectSquare(2.25), false);
assert.equal(isPerfectSquare(-4), false);
assert.deepEqual(squareRoot(fraction(64, 1)), { exact: true, value: fraction(8, 1) });
assert.deepEqual(squareRoot(fraction(9, 4)), { exact: true, value: fraction(3, 2) });
assert.deepEqual(squareRoot(fraction(0, 1)), { exact: true, value: fraction(0, 1) });
const rootOf72 = squareRoot(fraction(72, 1));
assert.equal(rootOf72.exact, false);
assert.equal(rootOf72.value.toFixed(4), '8.4853');
assert.throws(() => squareRoot(fraction(-1, 4)), /negative/);
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
assert.throws(() => probability(ids(die, 'even'), die.outcomes, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 }), /outcome "6" has no weight/);

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
assert.throws(() => getSetup('toString'), /unknown setup "toString"/);
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
assert.equal(describe.announcementFor(shown, { type: 'show-answer' }), 'The answer: HH, HT and TH. 3 of 4 squares, so P of A = 3/4 = 0.75.');

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
// An empty A ∩ B is worded, not drawn as "{}", on every two-event setup.
assert.equal(describe.readoutLines(run('dice-operations', { type: 'preset', event: 'B', preset: 'clear' }))[3], 'A and B: no shared outcome, 0 of 36');
assert.equal(describe.readoutLines(run('dice-condition', { type: 'preset', event: 'A', preset: 'clear' }))[2], 'A and B: no shared outcome, 0 of 36');

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
assert.equal(describe.announcementFor(setsView, { type: 'stage', stage: 'sets' }), 'omega = {HH, HT, TH, TT}. A = {HH, HT, TH}. P of A = the size of A over the size of omega = 3/4');
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
assert.equal(describe.announcementFor(shrunkToggle, { type: 'toggle', id: '4-4' }), 'Inside B: 6 outcomes, 3 of them also in A, {(4,4), (5,5), (6,6)}. P of A given B = 3/6 = 1/2 = 0.50, while P of A = 7/36 ≈ 0.19.');
const shrunkPreset = reducer(shrunk, { type: 'preset', event: 'A', preset: 'clear' });
assert.equal(describe.announcementFor(shrunkPreset, { type: 'preset', event: 'A', preset: 'clear' }), 'Inside B: 6 outcomes, none of them also in A. P of A given B = 0/6 = 0, while P of A = 0/36 = 0.');
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
assert.equal(emptiedWhileShrunk.shrinkRefusal, 'b-empty');
assert.equal(describe.announcementFor(emptiedWhileShrunk, { type: 'preset', event: 'B', preset: 'clear' }), "Undefined: B can't happen (probability 0).");
// Shrinking only exists where a setup offers the switch, and Reset un-shrinks.
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

// ---- Monty Hall: six equally likely games, shrunk to the door the host opens ----
const monty = SCENARIOS['monty-hall'];
const montyIds = (event) => ids(monty, event);
// Rows are the car's door, columns the host's coin; each cell names the door he opens.
assert.equal(monty.outcomes.length, 6);
assert.deepEqual(monty.outcomes.map((outcome) => outcome.label), ['opens 2', 'opens 3', 'opens 3', 'opens 3', 'opens 2', 'opens 2']);
assert.deepEqual(monty.rowValues, ['door 1', 'door 2', 'door 3']);
// Only worded row headers get the no-wrap rule; every other scenario keeps its single-symbol header column.
assert.deepEqual(Object.values(SCENARIOS).filter(hasWordedRowHeaders).map((scenario) => scenario.id), ['monty-hall']);
assert.deepEqual(monty.colValues, ['heads', 'tails']);
assert.equal(monty.outcomes[2].spoken, 'car behind door 2, coin heads, host opens door 3');
assert.equal(monty.mirrorOf('1-H'), undefined);
// Every cell is one game of 1/3 × 1/2 = 1/6: the coin turns the host's 50/50 tie-break into equal cells.
assert.deepEqual(multiplyFractions(fraction(1, 3), fraction(1, 2)), probability(new Set(['1-H']), monty.outcomes));
for (const outcome of monty.outcomes) assert.deepEqual(probability(new Set([outcome.id]), monty.outcomes), fraction(1, 6));
assert.deepEqual([...montyIds('opens-3')], ['1-T', '2-H', '2-T']);
assert.deepEqual([...montyIds('opens-2')], ['1-H', '3-H', '3-T']);
for (const car of ['car-1', 'car-2', 'car-3']) assert.deepEqual(probability(montyIds(car), monty.outcomes), fraction(1, 3));
assert.deepEqual(probability(montyIds('opens-3'), monty.outcomes), fraction(1, 2));
// The rows read as likelihoods: P(opens 3 | car behind door 1, 2, 3) = 1/2, 1, 0.
assert.deepEqual(['car-1', 'car-2', 'car-3'].map((car) => model.conditionalProbability(montyIds('opens-3'), montyIds(car))), [fraction(1, 2), fraction(1, 1), fraction(0, 1)]);
// The posteriors the page quotes.
const montyGiven = (car, opened) => model.conditionalProbability(montyIds(car), montyIds(opened));
assert.deepEqual(['car-1', 'car-2', 'car-3'].map((car) => montyGiven(car, 'opens-3')), [fraction(1, 3), fraction(2, 3), fraction(0, 1)]);
assert.deepEqual(['car-1', 'car-2', 'car-3'].map((car) => montyGiven(car, 'opens-2')), [fraction(1, 3), fraction(0, 1), fraction(2, 3)]);
assert.deepEqual([intersect(montyIds('car-1'), montyIds('opens-3')).size, intersect(montyIds('car-2'), montyIds('opens-3')).size, intersect(montyIds('car-3'), montyIds('opens-3')).size], [1, 2, 0]);

// Fixed data, opening on A = car behind door 1 and B = host opens door 3, not yet shrunk. The "A and B" line is held,
// because 1 of 6 beside 3 of 6 would answer the page's question before the reader shrinks.
const montySetup = getSetup('monty-condition');
assert.equal(montySetup.mode, 'condition');
assert.equal(montySetup.holdOverlap, true);
assert.deepEqual(montySetup.chalkNote, { long: "the coin column is the host's tie-break", short: 'coin = tie-break' });
const montyFresh = initialState('monty-condition');
const montyRun = (...actions) => actions.reduce(reducer, montyFresh);
const shrinkOn = { type: 'shrink', on: true };
const montyA = (preset) => ({ type: 'preset', event: 'A', preset });
const montyB = (preset) => ({ type: 'preset', event: 'B', preset });
assert.equal(montyFresh.shrink, false);
assert.equal(describe.statusLine(montyFresh), '6 equally likely outcomes. A: car behind door 1. B: host opens door 3.');
assert.deepEqual(describe.readoutLines(montyFresh), ['A = car behind door 1: 2 of 6 = 1/3 (≈ 0.33)', 'B = host opens door 3: 3 of 6 = 1/2 (0.50)']);
assert.deepEqual(describe.readoutLines(montyRun(montyA('car-2'))), ['A = car behind door 2: 2 of 6 = 1/3 (≈ 0.33)', 'B = host opens door 3: 3 of 6 = 1/2 (0.50)']);
assert.equal(describe.announcementFor(montyRun(montyA('car-2')), montyA('car-2')), 'A set to car behind door 2: 2 of 6 outcomes.');
assert.equal(reducer(montyFresh, { type: 'toggle', id: '1-H' }), montyFresh);
assert.deepEqual(['car-1', 'car-2', 'car-3'].map((preset) => describe.presetLabel(monty, preset)), ['Car behind door 1', 'Car behind door 2', 'Car behind door 3']);
assert.deepEqual(['opens-3', 'opens-2'].map((preset) => describe.presetLabel(monty, preset)), ['Host opens door 3', 'Host opens door 2']);
// Shrunk to "host opens door 3": the share of B that is A, read from the board.
const montyShrunk = montyRun(shrinkOn);
assert.equal(describe.statusLine(montyShrunk), '6 equally likely outcomes. A: car behind door 1. B: host opens door 3. Shrunk to B: 3 outcomes left.');
assert.deepEqual(describe.readoutLines(montyShrunk), ['Inside B: 3 outcomes, 1 of them also in A, {(car 1, tails)}. P(A | B) = 1/3 ≈ 0.33, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
assert.deepEqual(describe.readoutLines(montyRun(shrinkOn, montyA('car-2'))), ['Inside B: 3 outcomes, 2 of them also in A, {(car 2, heads), (car 2, tails)}. P(A | B) = 2/3 ≈ 0.67, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
assert.deepEqual(describe.readoutLines(montyRun(shrinkOn, montyA('car-3'))), ['Inside B: 3 outcomes, none of them also in A. P(A | B) = 0/3 = 0, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
assert.equal(describe.announcementFor(montyRun(shrinkOn, montyA('car-2')), montyA('car-2')), 'Inside B: 3 outcomes, 2 of them also in A, {(car 2, heads), (car 2, tails)}. P of A given B = 2/3 ≈ 0.67, while P of A = 2/6 = 1/3 ≈ 0.33.');
// The second preset for B: the host opens door 2.
assert.deepEqual(describe.readoutLines(montyRun(montyB('opens-2'), shrinkOn)), ['Inside B: 3 outcomes, 1 of them also in A, {(car 1, heads)}. P(A | B) = 1/3 ≈ 0.33, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
assert.deepEqual(describe.readoutLines(montyRun(montyB('opens-2'), shrinkOn, montyA('car-3'))), ['Inside B: 3 outcomes, 2 of them also in A, {(car 3, heads), (car 3, tails)}. P(A | B) = 2/3 ≈ 0.67, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
// The page's order: shrink first, press Car behind door 2, then Host opens door 2. Changing B keeps the board shrunk.
const montyPageOrder = montyRun(shrinkOn, montyA('car-2'), montyB('opens-2'));
assert.equal(montyPageOrder.shrink, true);
assert.deepEqual(describe.readoutLines(montyPageOrder), ['Inside B: 3 outcomes, none of them also in A. P(A | B) = 0/3 = 0, while P(A) = 2/6 = 1/3 ≈ 0.33.']);
assert.deepEqual(describe.readoutLines(reducer(montyPageOrder, montyA('car-1'))), describe.readoutLines(montyRun(montyB('opens-2'), shrinkOn)));
assert.deepEqual(describe.readoutLines(reducer(montyPageOrder, montyA('car-3'))), describe.readoutLines(montyRun(montyB('opens-2'), shrinkOn, montyA('car-3'))));
assert.equal(reducer(montyPageOrder, montyA('car-3')).shrink, true);
// Cells start with the visible label "opens 3" (label in name), then say the game with its subject, then membership.
assert.equal(describe.cellName(montyShrunk, monty.outcomes[1]), 'opens 3. Car behind door 1, coin tails, host opens door 3. In A and B.');
assert.equal(describe.cellName(montyShrunk, monty.outcomes[0]), 'opens 2. Car behind door 1, coin heads, host opens door 2. In A. Ruled out.');
assert.equal(describe.cellName(montyShrunk, monty.outcomes[4]), 'opens 2. Car behind door 3, coin heads, host opens door 2. Ruled out.');
// Un-shrinking holds the line again, and Reset returns to the opening.
assert.deepEqual(describe.readoutLines(reducer(montyShrunk, { type: 'shrink', on: false })), describe.readoutLines(montyFresh));
assert.deepEqual(reducer(montyRun(shrinkOn, montyA('car-2')), { type: 'reset' }), montyFresh);
// Only condition setups can hold the line, and a chalk note never carries a number.
assert.throws(() => validateSetup({ ...getSetup('dice-operations'), holdOverlap: true }), /count setup "dice-operations" can't hold the "A and B" line/);
assert.throws(() => validateSetup({ ...montySetup, chalkNote: { long: 'switch wins 2/3', short: 'switch' } }), /setup "monty-condition" has a number in its chalk note/);
// Setups without holdOverlap keep the line before shrinking (pinned above for dice-condition and kids-condition).
assert.equal(getSetup('dice-condition').holdOverlap, undefined);

// ---- Compare mode: independence and mutual exclusivity (v1.3) ----
const setupsModule = await import('../src/components/react/eventSpace/setups.ts');
const stateModule = await import('../src/components/react/eventSpace/state.ts');
const coinDie = SCENARIOS['coin-die'];
const weather = SCENARIOS['weather-days'];
const loadedFill = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 7 };

// The new spaces: a coin beside a die, 12 fixed days of weather, and one die drawn as a list.
assert.deepEqual(coinDie.outcomes.map((outcome) => outcome.label), ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6']);
assert.equal(coinDie.outcomes[3].spoken, 'coin heads, die 4');
assert.equal(coinDie.mirrorOf('H4'), undefined);
assert.equal(die.layout, 'list');
assert.equal(die.outcomes[2].spoken, 'face 3');
assert.deepEqual([...ids(weather, 'rain-all-day')], ['day-2', 'day-6', 'day-10']);
assert.deepEqual([...ids(weather, 'sun-all-day')], ['day-3', 'day-5', 'day-8', 'day-11']);
assert.equal(ids(weather, 'some-rain').size, 8);
assert.equal(ids(weather, 'some-sun').size, 9);
assert.equal(weather.outcomes[0].spoken, 'sun and showers');
assert.equal(weather.outcomes[1].spoken, 'rain all day');

// P(A | B) with weights: the share of B's units that also lie in A; undefined when B can't happen.
assert.deepEqual(model.weightedConditional(ids(die, 'even'), ids(die, 'at-most-2'), die.outcomes, loadedFill), fraction(1, 2));
assert.equal(model.weightedConditional(ids(die, 'even'), new Set(), die.outcomes, loadedFill), null);
assert.deepEqual(model.weightedConditional(ids(dice, 'sum-at-least-10'), ids(dice, 'double'), dice.outcomes), fraction(1, 3));

// Independence is the product form, compared exactly. Grinstead & Snell Example 4.8: first coin heads and
// both the same are independent, 1/4 = 1/2 × 1/2. Example 4.9: first coin heads and two heads are not, 1/4 against 1/8.
const compareCoins = (a, b) => model.compareEvents(ids(coins, a), ids(coins, b), coins.outcomes);
assert.deepEqual(compareCoins('first-head', 'both-same'), {
	pA: fraction(1, 2),
	pB: fraction(1, 2),
	pBoth: fraction(1, 4),
	product: fraction(1, 4),
	given: fraction(1, 2),
	independent: true,
	exclusive: false,
});
const example49 = compareCoins('first-head', 'two-heads');
assert.deepEqual([example49.pBoth, example49.product, example49.independent], [fraction(1, 4), fraction(1, 8), false]);
// An event that can't happen is independent of everything, while P(A | B) is undefined; exclusivity comes from the sets.
const againstEmpty = model.compareEvents(ids(dice, 'sum-7'), new Set(), dice.outcomes);
assert.deepEqual([againstEmpty.independent, againstEmpty.exclusive, againstEmpty.given], [true, true, null]);
// Complements of independent events are independent: sum 7 and "first die not 6" give 5/36 = 1/6 × 5/6.
const withComplement = model.compareEvents(ids(dice, 'sum-7'), complement(ids(dice, 'first-6'), dice.outcomes), dice.outcomes);
assert.deepEqual([withComplement.pBoth, withComplement.independent], [fraction(5, 36), true]);
// The same sets, different probabilities: even and at most 2 are independent on a fair die, not on a loaded one.
assert.equal(model.compareEvents(ids(die, 'even'), ids(die, 'at-most-2'), die.outcomes, fairDie).independent, true);
const loadedPair = model.compareEvents(ids(die, 'even'), ids(die, 'at-most-2'), die.outcomes, loadedFill);
assert.deepEqual([loadedPair.pA, loadedPair.pB, loadedPair.pBoth, loadedPair.product, loadedPair.independent, loadedPair.exclusive], [fraction(3, 4), fraction(1, 6), fraction(1, 12), fraction(1, 8), false, false]);

// The setups, and one source for the die fills so the axioms page and the comparison page agree on "loaded".
for (const id of ['coin-die-independence', 'dice-independence', 'weather-exclusive', 'die-compare']) assert.equal(getSetup(id).mode, 'compare');
assert.deepEqual(setupsModule.DIE_WEIGHT_PRESETS, { 'Fair die': [2, 2, 2, 2, 2, 2], 'Loaded toward six': [1, 1, 1, 1, 1, 7] });
assert.deepEqual(getSetup('die-pour').weightPresets['Loaded toward six'], getSetup('die-compare').weightPresets['Loaded toward six']);
assert.equal(setupsModule.canShrink(getSetup('coin-die-independence')), true);
assert.equal(setupsModule.canShrink(getSetup('dice-condition')), true);
assert.equal(setupsModule.canShrink(getSetup('die-compare')), false);
assert.equal(setupsModule.canShrink(getSetup('dice-operations')), false);

// Compare setups refuse what they can't support, naming the setup.
const diceCompareSetup = getSetup('dice-independence');
const dieCompareSetup = getSetup('die-compare');
assert.throws(() => validateSetup({ ...diceCompareSetup, events: { A: diceCompareSetup.events.A } }), /compare setup "dice-independence" needs an event B/);
assert.throws(() => validateSetup({ ...diceCompareSetup, toss: true }), /compare setup "dice-independence" can't toss yet/);
assert.throws(() => validateSetup({ ...diceCompareSetup, lookAt: true }), /compare setup "dice-independence" can't use "Look at"/);
assert.throws(() => validateSetup({ ...diceCompareSetup, goal: 'double' }), /goal setup "dice-independence" can't use "Look at" or conditioning/);
assert.throws(() => validateSetup({ ...diceCompareSetup, wrongModel: true }), /compare setup "dice-independence" can't show a wrong model/);
assert.throws(() => validateSetup({ ...diceCompareSetup, stages: true }), /compare setup "dice-independence" can't offer stages/);
assert.throws(() => validateSetup({ ...diceCompareSetup, shrinkSwitch: false, weightPresets: { Even: Array(36).fill(1) }, initialWeights: 'Even' }), /compare setup "dice-independence" can weigh only the one-die space/);
assert.throws(() => validateSetup({ ...dieCompareSetup, weightPresets: { Short: [2, 2, 2, 2, 2, 1] }, initialWeights: 'Short' }), /"Short" pours 11 units; a compare setup needs exactly 12/);
assert.throws(() => validateSetup({ ...dieCompareSetup, weightPresets: { Gap: [0, 2, 2, 2, 2, 4] }, initialWeights: 'Gap' }), /"Gap" leaves a face with no units/);
assert.throws(() => validateSetup({ ...dieCompareSetup, initialWeights: undefined }), /compare setup "die-compare" has weight presets but no initialWeights/);
assert.throws(() => validateSetup({ ...dieCompareSetup, shrinkSwitch: true }), /setup "die-compare" can't combine weights with shrinking/);
assert.throws(() => validateSetup({ ...getSetup('dice-operations'), shrinkSwitch: true }), /count setup "dice-operations" can't shrink/);
assert.throws(() => validateSetup({ ...conditionSetup, shrinkSwitch: false }), /condition setup "dice-condition" needs the shrink switch/);

// Compare exists only in compare mode.
assert.equal(reducer(conditionFresh, { type: 'compare', on: true }), conditionFresh);
assert.equal(reducer(operations, { type: 'compare', on: true }), operations);

// coin-die-independence before Compare: P(A) and P(B) only. The A ∩ B line and Shrink are held, so nothing answers
// the page's prediction before the reader acts.
const coinDieFresh = initialState('coin-die-independence');
assert.equal(describe.statusLine(coinDieFresh), '12 equally likely outcomes. Editing A.');
assert.deepEqual(describe.readoutLines(coinDieFresh), ['A = die is 6: 2 of 12 = 1/6 (≈ 0.17)', 'B = coin is heads: 6 of 12 = 1/2 (0.50)']);
assert.equal(describe.compareLines(coinDieFresh), null);
assert.equal(describe.COMPARE_LABEL, 'Compare A and B');
assert.equal(describe.COMPARE_COVERED_NOTE, 'Turn on Compare A and B to see whether A and B are independent and whether they are mutually exclusive.');
assert.equal(stateModule.shrinkBlocked(coinDieFresh), 'compare-off');
const earlyShrink = reducer(coinDieFresh, { type: 'shrink', on: true });
assert.equal(earlyShrink.shrink, false);
assert.equal(describe.announcementFor(earlyShrink, { type: 'shrink', on: true }), 'Turn on Compare A and B first: shrinking to B would answer the question for you.');
assert.equal(describe.shrinkRefusalText('compare-off'), 'Turn on Compare A and B first: shrinking to B would answer the question for you.');
assert.equal(describe.shrinkRefusalText('b-empty'), "Undefined: B can't happen (probability 0).");

// Compare on: the A ∩ B line, then the verdict, exclusivity, the product and the conditional, in that order.
const coinDieCompared = reducer(coinDieFresh, { type: 'compare', on: true });
assert.deepEqual(describe.readoutLines(coinDieCompared), ['A = die is 6: 2 of 12 = 1/6 (≈ 0.17)', 'B = coin is heads: 6 of 12 = 1/2 (0.50)', 'A and B = {H6}: 1 of 12']);
const coinDieVerdict = [
	'Independent: yes.',
	'Mutually exclusive: no, A and B share 1 outcome, {H6}.',
	'P(A and B) = 1/12, and P(A) × P(B) = 1/6 × 1/2 = 1/12: equal.',
];
assert.deepEqual(describe.compareLines(coinDieCompared), [...coinDieVerdict, 'P(A | B) = 1/6 and P(A) = 1/6: learning that B happened leaves the chance of A unchanged.']);
// Spoken, the symbols become words: "P of A and B", not "P left paren A and B".
assert.equal(
	describe.announcementFor(coinDieCompared, { type: 'compare', on: true }),
	'Independent: yes. Mutually exclusive: no, A and B share 1 outcome, {H6}. P of A and B = 1/12, and P of A times P of B = 1/6 times 1/2 = 1/12: equal.',
);

// Shrink, once Compare is on: "Inside B" replaces the readouts, and the conditional line is left out as repeated.
const coinDieShrunk = reducer(coinDieCompared, { type: 'shrink', on: true });
assert.equal(coinDieShrunk.shrink, true);
assert.deepEqual(describe.readoutLines(coinDieShrunk), ['Inside B: 6 outcomes, 1 of them also in A, {H6}. P(A | B) = 1/6 ≈ 0.17, while P(A) = 2/12 = 1/6 ≈ 0.17.']);
assert.deepEqual(describe.compareLines(coinDieShrunk), coinDieVerdict);
assert.equal(describe.announcementFor(coinDieShrunk, { type: 'shrink', on: true }), 'Inside B: 6 outcomes, 1 of them also in A, {H6}. P of A given B = 1/6 ≈ 0.17, while P of A = 2/12 = 1/6 ≈ 0.17.');

// Precedence with Compare and Shrink both on: the new P(A | B), then the verdict in short.
const evenShrunk = reducer(coinDieShrunk, { type: 'preset', event: 'A', preset: 'die-even' });
assert.equal(
	describe.announcementFor(evenShrunk, { type: 'preset', event: 'A', preset: 'die-even' }),
	'Inside B: 6 outcomes, 3 of them also in A, {H2, H4, H6}. P of A given B = 3/6 = 1/2 = 0.50, while P of A = 6/12 = 1/2 = 0.50. Independent: yes. Mutually exclusive: no.',
);
const toggledShrunk = reducer(coinDieShrunk, { type: 'toggle', id: 'H1' });
assert.equal(
	describe.announcementFor(toggledShrunk, { type: 'toggle', id: 'H1' }),
	'Inside B: 6 outcomes, 2 of them also in A, {H1, H6}. P of A given B = 2/6 = 1/3 ≈ 0.33, while P of A = 3/12 = 1/4 = 0.25. Independent: no. Mutually exclusive: no.',
);
// Emptying B while shrunk un-shrinks, says why, and still gives the verdict.
const emptiedB = reducer(coinDieShrunk, { type: 'preset', event: 'B', preset: 'clear' });
assert.deepEqual([emptiedB.shrink, emptiedB.shrinkRefusal], [false, 'b-empty']);
assert.equal(
	describe.announcementFor(emptiedB, { type: 'preset', event: 'B', preset: 'clear' }),
	"Undefined: B can't happen (probability 0). Independent: yes, but only because B can't happen. Mutually exclusive: yes.",
);
// Compare on, not shrunk: the count, then the verdict in short.
const toggledCompared = reducer(coinDieCompared, { type: 'toggle', id: 'H1' });
assert.equal(describe.announcementFor(toggledCompared, { type: 'toggle', id: 'H1' }), 'A: 3 of 12 outcomes, P of A = 1/4. Independent: no. Mutually exclusive: no.');
// Turning Compare off hides the verdict and the A ∩ B line again, and un-shrinks, so the held lines stay held.
const comparedOff = reducer(coinDieShrunk, { type: 'compare', on: false });
assert.deepEqual([comparedOff.compare, comparedOff.shrink], [false, false]);
assert.equal(describe.announcementFor(comparedOff, { type: 'compare', on: false }), 'Comparison hidden.');
assert.deepEqual(describe.readoutLines(comparedOff), ['A = die is 6: 2 of 12 = 1/6 (≈ 0.17)', 'B = coin is heads: 6 of 12 = 1/2 (0.50)']);
// Reset clears both.
const coinDieReset = reducer(coinDieShrunk, { type: 'reset' });
assert.deepEqual([coinDieReset.compare, coinDieReset.shrink], [false, false]);

// The other coin-die presets: an event built from the coin depends on the coin.
const coinDieWith = (...actions) => describe.compareLines(run('coin-die-independence', { type: 'compare', on: true }, ...actions));
assert.deepEqual(coinDieWith({ type: 'preset', event: 'A', preset: 'heads-and-six' }), [
	'Independent: no.',
	'Mutually exclusive: no, A and B share 1 outcome, {H6}.',
	'P(A and B) = 1/12 (≈ 0.08), but P(A) × P(B) = 1/12 × 1/2 = 1/24 (≈ 0.04): not equal.',
	'P(A | B) = 1/6 (≈ 0.17), while P(A) = 1/12 (≈ 0.08): learning that B happened changes the chance of A.',
]);
assert.deepEqual(coinDieWith({ type: 'preset', event: 'A', preset: 'die-even' }, { type: 'preset', event: 'B', preset: 'tails' }).slice(1, 3), [
	'Mutually exclusive: no, A and B share 3 outcomes, {T2, T4, T6}.',
	'P(A and B) = 1/4, and P(A) × P(B) = 1/2 × 1/2 = 1/4: equal.',
]);
assert.equal(
	describe.announcementFor(run('coin-die-independence', { type: 'compare', on: true }, { type: 'preset', event: 'A', preset: 'heads-and-six' }), { type: 'preset', event: 'A', preset: 'heads-and-six' }),
	'A set to heads and a six: 1 of 12 outcomes. Independent: no. Mutually exclusive: no.',
);

// dice-independence: every pair the two pages quote, reached with presets alone.
const diceFreshCompare = initialState('dice-independence');
assert.deepEqual(describe.readoutLines(diceFreshCompare), ['A = sum is 7: 6 of 36 = 1/6 (≈ 0.17)', 'B = first die is 6: 6 of 36 = 1/6 (≈ 0.17)']);
const diceWith = (...actions) => describe.compareLines(run('dice-independence', { type: 'compare', on: true }, ...actions));
const presetA = (preset) => ({ type: 'preset', event: 'A', preset });
const presetB = (preset) => ({ type: 'preset', event: 'B', preset });
assert.deepEqual(diceWith(), [
	'Independent: yes.',
	'Mutually exclusive: no, A and B share 1 outcome, {(6,1)}.',
	'P(A and B) = 1/36, and P(A) × P(B) = 1/6 × 1/6 = 1/36: equal.',
	'P(A | B) = 1/6 and P(A) = 1/6: learning that B happened leaves the chance of A unchanged.',
]);
assert.deepEqual(diceWith(presetA('sum-8')), [
	'Independent: no.',
	'Mutually exclusive: no, A and B share 1 outcome, {(6,2)}.',
	'P(A and B) = 1/36 (≈ 0.03), but P(A) × P(B) = 5/36 × 1/6 = 5/216 (≈ 0.02): not equal.',
	'P(A | B) = 1/6 (≈ 0.17), while P(A) = 5/36 (≈ 0.14): learning that B happened changes the chance of A.',
]);
assert.equal(diceWith(presetA('double'))[2], 'P(A and B) = 1/36, and P(A) × P(B) = 1/6 × 1/6 = 1/36: equal.');
assert.equal(diceWith(presetB('second-6'))[0], 'Independent: yes.');
assert.deepEqual(diceWith(presetB('double')).slice(0, 3), [
	'Independent: no.',
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, but P(A) × P(B) = 1/6 × 1/6 = 1/36 (≈ 0.03): not equal.',
]);
assert.equal(diceWith(presetA('double'), presetB('double'))[2], 'P(A and B) = 1/6 (≈ 0.17), but P(A) × P(B) = 1/6 × 1/6 = 1/36 (≈ 0.03): not equal.');
assert.deepEqual(diceWith(presetA('sum-at-least-10'), presetB('double')).slice(2), [
	'P(A and B) = 1/18 (≈ 0.06), but P(A) × P(B) = 1/6 × 1/6 = 1/36 (≈ 0.03): not equal.',
	'P(A | B) = 1/3 (≈ 0.33), while P(A) = 1/6 (≈ 0.17): learning that B happened changes the chance of A.',
]);
assert.deepEqual(diceWith(presetA('sum-at-least-10')).slice(1, 3), [
	'Mutually exclusive: no, A and B share 3 outcomes, {(6,4), (6,5), (6,6)}.',
	'P(A and B) = 1/12 (≈ 0.08), but P(A) × P(B) = 1/6 × 1/6 = 1/36 (≈ 0.03): not equal.',
]);
assert.deepEqual(diceWith(presetB('clear')), [
	"Independent: yes, but only because B can't happen.",
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, and P(A) × P(B) = 1/6 × 0 = 0: equal.',
	"P(A | B) is undefined, because B can't happen.",
]);
assert.equal(
	describe.announcementFor(run('dice-independence', { type: 'compare', on: true }, presetB('clear')), presetB('clear')),
	"B cleared. Independent: yes, but only because B can't happen. Mutually exclusive: yes.",
);
const noBCompared = run('dice-independence', { type: 'compare', on: true }, presetB('clear'));
assert.equal(stateModule.shrinkBlocked(noBCompared), 'b-empty');
assert.equal(describe.announcementFor(reducer(noBCompared, { type: 'shrink', on: true }), { type: 'shrink', on: true }), "Undefined: B can't happen (probability 0).");
// A burst of toggles while Compare is on ends in one announcement with the verdict.
const sum8Toggled = run('dice-independence', { type: 'compare', on: true }, presetA('sum-8'), ...toggles('1-1', '1-1'));
assert.equal(describe.announcementFor(sum8Toggled, { type: 'toggle', id: '1-1' }), 'A: 5 of 36 outcomes, P of A = 5/36. Independent: no. Mutually exclusive: no.');
// The comparison page quotes its pairs the other way round (A = first die 6, B = sum 7, and so on). Swapping A and B
// changes no number and no verdict the board shows, and each swapped pair loads from presets. Its fourth pair, first
// die 6 with second die 6, is left out on purpose: neither event is an A preset and A is at the four-preset cap
// (its presets serve the independence page), so that page makes the same point with sum 7 and first die 6.
// The preset lists are pinned so that any change to them is a deliberate one.
assert.deepEqual(diceCompareSetup.events.A.presets, ['sum-7', 'sum-8', 'double', 'sum-at-least-10']);
assert.deepEqual(diceCompareSetup.events.B.presets, ['first-6', 'second-6', 'double', 'clear']);
for (const [a, b] of [['sum-7', 'first-6'], ['sum-7', 'double'], ['sum-at-least-10', 'first-6']]) {
	assert.ok(diceCompareSetup.events.A.presets.includes(a) && diceCompareSetup.events.B.presets.includes(b), `${a} with ${b} loads from presets`);
	assert.deepEqual(model.compareEvents(ids(dice, a), ids(dice, b), dice.outcomes), model.compareEvents(ids(dice, b), ids(dice, a), dice.outcomes));
}

// weather-exclusive: fixed days, with presets that show exclusivity is not the only way to be dependent.
const weatherFresh = initialState('weather-exclusive');
assert.equal(describe.statusLine(weatherFresh), '12 equally likely outcomes. A: rain all day. B: sun all day.');
assert.deepEqual(describe.readoutLines(weatherFresh), ['A = rain all day: 3 of 12 = 1/4 (0.25)', 'B = sun all day: 4 of 12 = 1/3 (≈ 0.33)']);
assert.equal(reducer(weatherFresh, { type: 'toggle', id: 'day-1' }), weatherFresh);
assert.equal(describe.cellName(weatherFresh, weather.outcomes[1]), '2. Rain all day. In A.');
const weatherCompared = reducer(weatherFresh, { type: 'compare', on: true });
assert.equal(describe.readoutLines(weatherCompared)[2], 'A and B: no shared outcome, 0 of 12');
assert.deepEqual(describe.compareLines(weatherCompared), [
	'Independent: no.',
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, but P(A) × P(B) = 1/4 × 1/3 = 1/12 (≈ 0.08): not equal.',
	'P(A | B) = 0, while P(A) = 1/4 (0.25): learning that B happened changes the chance of A.',
]);
assert.deepEqual(describe.readoutLines(reducer(weatherCompared, { type: 'shrink', on: true })), ['Inside B: 4 outcomes, none of them also in A. P(A | B) = 0/4 = 0, while P(A) = 3/12 = 1/4 = 0.25.']);
const someOfEach = run('weather-exclusive', { type: 'compare', on: true }, presetA('some-rain'), presetB('some-sun'));
assert.equal(describe.statusLine(someOfEach), '12 equally likely outcomes. A: some rain. B: some sun.');
assert.deepEqual(describe.compareLines(someOfEach).slice(0, 3), [
	'Independent: no.',
	'Mutually exclusive: no, A and B share 5 outcomes, {1, 4, 7, 9, 12}.',
	'P(A and B) = 5/12 (≈ 0.42), but P(A) × P(B) = 2/3 × 3/4 = 1/2 (0.50): not equal.',
]);
assert.equal(describe.compareLines(run('weather-exclusive', { type: 'compare', on: true }, presetB('some-sun')))[2], 'P(A and B) = 0, but P(A) × P(B) = 1/4 × 3/4 = 3/16 (≈ 0.19): not equal.');

// die-compare: fixed sets chosen with presets, and two fixed fills of 12 units. Exclusivity is about the sets,
// independence about the probabilities.
const dieFresh = initialState('die-compare');
assert.equal(describe.statusLine(dieFresh), '6 outcomes, one for each face. Fair die: every face carries 2 of 12 units, so the outcomes are equally likely. A: at most 2. B: 5 or 6.');
assert.deepEqual(describe.readoutLines(dieFresh), ['A = at most 2: 4 of 12 units = 1/3 (≈ 0.33)', 'B = 5 or 6: 4 of 12 units = 1/3 (≈ 0.33)']);
assert.equal(stateModule.activeWeightPreset(dieFresh), 'Fair die');
assert.deepEqual(stateModule.weightsOf(dieFresh), fairDie);
assert.equal(stateModule.weightsOf(coinDieFresh), undefined);
assert.equal(reducer(dieFresh, { type: 'toggle', id: '1' }), dieFresh);
assert.equal(reducer(dieFresh, { type: 'shrink', on: true }), dieFresh);
assert.equal(describe.cellName(dieFresh, die.outcomes[1]), '2. Face 2. In A. 2 of 12 units.');
assert.equal(describe.unitsNote(dieFresh, die.outcomes[1]), '2/12');
const dieCompared = reducer(dieFresh, { type: 'compare', on: true });
assert.equal(describe.readoutLines(dieCompared)[2], 'A and B: no shared outcome, 0 of 12 units');
assert.deepEqual(describe.compareLines(dieCompared), [
	'Independent: no.',
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, but P(A) × P(B) = 1/3 × 1/3 = 1/9 (≈ 0.11): not equal.',
	'P(A | B) = 0, while P(A) = 1/3 (≈ 0.33): learning that B happened changes the chance of A.',
]);
assert.equal(
	describe.announcementFor(dieCompared, { type: 'compare', on: true }),
	'Independent: no. Mutually exclusive: yes, A and B share no outcome. P of A and B = 0, but P of A times P of B = 1/3 times 1/3 = 1/9 (≈ 0.11): not equal.',
);
const dieWith = (...actions) => describe.compareLines(run('die-compare', { type: 'compare', on: true }, ...actions));
const loaded = { type: 'weight-preset', name: 'Loaded toward six' };
assert.deepEqual(dieWith(presetB('even')).slice(0, 3), [
	'Independent: yes.',
	'Mutually exclusive: no, A and B share 1 outcome, {2}.',
	'P(A and B) = 1/6, and P(A) × P(B) = 1/3 × 1/2 = 1/6: equal.',
]);
assert.equal(describe.readoutLines(run('die-compare', { type: 'compare', on: true }, presetB('even')))[2], 'A and B = {2}: 2 of 12 units');
assert.deepEqual(dieWith(presetA('even'), presetB('at-least-4')).slice(2), [
	'P(A and B) = 1/3 (≈ 0.33), but P(A) × P(B) = 1/2 × 1/2 = 1/4 (0.25): not equal.',
	'P(A | B) = 2/3 (≈ 0.67), while P(A) = 1/2 (0.50): learning that B happened changes the chance of A.',
]);
assert.deepEqual(dieWith(presetA('clear')), [
	"Independent: yes, but only because A can't happen.",
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, and P(A) × P(B) = 0 × 1/3 = 0: equal.',
	'P(A | B) = 0 and P(A) = 0: learning that B happened leaves the chance of A unchanged.',
]);
assert.equal(dieWith(presetA('clear'), presetB('at-most-2'))[0], "Independent: yes, but only because A can't happen.");
// Loaded toward six: the same sets, a different verdict.
const loadedEven = run('die-compare', presetB('even'), loaded);
assert.equal(stateModule.activeWeightPreset(loadedEven), 'Loaded toward six');
assert.equal(describe.statusLine(loadedEven), '6 outcomes, one for each face. Loaded toward six: the faces carry 1, 1, 1, 1, 1 and 7 of 12 units. A: at most 2. B: even.');
assert.equal(describe.announcementFor(loadedEven, loaded), 'Loaded toward six: the faces carry 1, 1, 1, 1, 1 and 7 of 12 units.');
assert.equal(describe.announcementFor(run('die-compare', loaded, { type: 'weight-preset', name: 'Fair die' }), { type: 'weight-preset', name: 'Fair die' }), 'Fair die: every face carries 2 of 12 units, so the outcomes are equally likely.');
assert.equal(describe.cellName(loadedEven, die.outcomes[5]), '6. Face 6. In B. 7 of 12 units.');
assert.equal(describe.unitsNote(loadedEven, die.outcomes[5]), '7/12');
assert.deepEqual(dieWith(presetB('even'), loaded), [
	'Independent: no.',
	'Mutually exclusive: no, A and B share 1 outcome, {2}.',
	'P(A and B) = 1/12 (≈ 0.08), but P(A) × P(B) = 1/6 × 3/4 = 1/8 (≈ 0.13): not equal.',
	'P(A | B) = 1/9 (≈ 0.11), while P(A) = 1/6 (≈ 0.17): learning that B happened changes the chance of A.',
]);
assert.equal(describe.announcementFor(run('die-compare', { type: 'compare', on: true }, presetB('even'), loaded), loaded), 'Loaded toward six. Independent: no. Mutually exclusive: no.');
assert.equal(dieWith(loaded)[2], 'P(A and B) = 0, but P(A) × P(B) = 1/6 × 2/3 = 1/9 (≈ 0.11): not equal.');
// The comparison page's own pair: P(even | at most 2) stays 1/2 while P(even) moves from 1/2 to 3/4.
assert.equal(dieWith(presetA('even'), presetB('at-most-2'))[3], 'P(A | B) = 1/2 and P(A) = 1/2: learning that B happened leaves the chance of A unchanged.');
assert.equal(dieWith(presetA('even'), presetB('at-most-2'), loaded)[3], 'P(A | B) = 1/2 (0.50), while P(A) = 3/4 (0.75): learning that B happened changes the chance of A.');
assert.equal(describe.announcementFor(run('die-compare', presetB('even')), presetB('even')), 'B set to even: 6 of 12 units.');
// Reset brings back the fair die with Compare off.
const dieReset = reducer(run('die-compare', { type: 'compare', on: true }, loaded), { type: 'reset' });
assert.deepEqual([stateModule.activeWeightPreset(dieReset), dieReset.compare], ['Fair die', false]);

// Neither event can happen: still independent by the product form, and P(A | B) has no value.
const bothCleared = run('coin-die-independence', { type: 'compare', on: true }, presetA('clear'), presetB('clear'));
assert.deepEqual(describe.compareLines(bothCleared), [
	'Independent: yes, but only because neither A nor B can happen.',
	'Mutually exclusive: yes, A and B share no outcome.',
	'P(A and B) = 0, and P(A) × P(B) = 0 × 0 = 0: equal.',
	"P(A | B) is undefined, because B can't happen.",
]);
assert.equal(describe.announcementFor(bothCleared, presetB('clear')), 'B cleared. Independent: yes, but only because neither A nor B can happen. Mutually exclusive: yes.');

// The boards' accessible names, the grids' names and every new preset button, word for word.
assert.deepEqual(
	['coin-die-independence', 'dice-independence', 'weather-exclusive', 'die-compare'].map((id) => getSetup(id).label),
	[
		'The 12 outcomes of flipping a coin and rolling a die, with events A and B to compare.',
		'The 36 outcomes of rolling two dice, with events A and B to compare.',
		'12 days from one spring, one picked at random, with events A and B to compare.',
		'One roll of a die, fair or loaded, with events A and B to compare.',
	],
);
assert.equal(coinDie.describeSpace, 'a coin flip and a die roll');
assert.equal(weather.describeSpace, '12 days from one spring, one day picked at random');
const presetLabelsOf = (id) => {
	const setup = getSetup(id);
	return ['A', 'B'].map((key) => setup.events[key].presets.map((preset) => describe.presetLabel(SCENARIOS[setup.scenario], preset)));
};
assert.deepEqual(presetLabelsOf('coin-die-independence'), [['Die is 6', 'Die is even', 'Heads and a six', 'Clear'], ['Coin is heads', 'Coin is tails', 'Clear']]);
assert.deepEqual(presetLabelsOf('dice-independence'), [['Sum is 7', 'Sum is 8', 'Doubles', 'Sum is at least 10'], ['First die is 6', 'Second die is 6', 'Doubles', 'Clear']]);
assert.deepEqual(presetLabelsOf('weather-exclusive'), [['Rain all day', 'Some rain'], ['Sun all day', 'Some sun']]);
assert.deepEqual(presetLabelsOf('die-compare'), [['At most 2', 'Even', 'Clear'], ['5 or 6', 'Even', 'At least 4', 'At most 2']]);

// ---- BayesTheorem scenarios (week 2 presets) ----
const bayes = await import('../src/components/react/bayesTheorem/scenarios.ts');
const { formatNumber } = await import('../src/components/react/plotColors.ts');
const posteriorOf = (id) => bayes.computePosterior(bayes.BAYES_SCENARIOS[id].values);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} is not ${expected}`);
// Medical test: 1 in 100 has the condition, the test is right 9 times in 10. A positive means only 1/12 ≈ 0.083.
near(posteriorOf('medical-test').evidence, 0.108);
near(posteriorOf('medical-test').posterior, 1 / 12);
// Wet lawn: P(rain) = 0.2, P(wet | rain) = 0.9, P(wet | no rain) = 0.3 gives 0.18 / 0.42 = 3/7 ≈ 0.429.
near(posteriorOf('wet-lawn').evidence, 0.42);
near(posteriorOf('wet-lawn').posterior, 3 / 7);
near(posteriorOf('any-events').posterior, 0.24 / 0.31);
// Labels: a thin column's labels sit beside it, and its "B and …" label never lands on the other event's fill.
const bayesLabels = await import('../src/components/react/bayesTheorem/labels.ts');
// The published Bayes page's opening on Medical test keeps its labels where they were: beside A, level with its block.
assert.deepEqual(bayesLabels.labelPositions(bayes.BAYES_SCENARIOS['medical-test'].values).aName, { x: 0.02, y: bayesLabels.NAME_Y, attach: 'e' });
assert.deepEqual(bayesLabels.labelPositions(bayes.BAYES_SCENARIOS['medical-test'].values).bAndA, { x: 0.02, y: 0.45, attach: 'e' });
// The Bayes page drags Wet lawn's P(A) to 0.99: the not-A column is a sliver and B and A fills 0.9 of A's column,
// so "B and not A" goes under the square instead of onto the B-and-A block.
assert.deepEqual(bayesLabels.labelPositions({ ...bayes.BAYES_SCENARIOS['wet-lawn'].values, prior: 0.99 }).bAndNotA, { x: 0.98, y: bayesLabels.BELOW_SQUARE_Y, attach: 'w' });
const labelGrid = [0.01, 0.05, 0.1, 0.14, 0.15, 0.3, 0.5, 0.85, 0.86, 0.9, 0.92, 0.95, 0.99];
const labelCases = [
	...Object.values(bayes.BAYES_SCENARIOS).map((scenario) => scenario.values),
	...labelGrid.flatMap((prior) => labelGrid.flatMap((likelihood) => labelGrid.map((falsePositive) => ({ prior, likelihood, falsePositive })))),
];
for (const values of labelCases) {
	const { bAndA, bAndNotA } = bayesLabels.labelPositions(values);
	const cases = [
		{ label: bAndA, otherFill: values.falsePositive, name: 'B and A' },
		{ label: bAndNotA, otherFill: values.likelihood, name: 'B and not A' },
	];
	for (const { label, otherFill, name } of cases) {
		if (label.attach === undefined) continue;
		const clearOfFill = label.y < 0 || label.y - bayesLabels.LABEL_MARGIN >= otherFill - 1e-9;
		assert.ok(clearOfFill, `"${name}" sits on the other event's fill at ${JSON.stringify(values)}: y = ${label.y}`);
		assert.ok(label.y <= bayesLabels.NAME_Y - 2 * bayesLabels.LABEL_MARGIN + 1e-9, `"${name}" crowds the column name at ${JSON.stringify(values)}`);
	}
}
assert.equal(bayes.BAYES_SCENARIOS[bayes.DEFAULT_SCENARIO].id, 'any-events');
// Every scenario sits on the sliders' 0.01 grid inside their range, so loading one never clamps a value.
for (const scenario of Object.values(bayes.BAYES_SCENARIOS)) {
	for (const value of Object.values(scenario.values)) {
		assert.ok(value >= 0.01 && value <= 0.99 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, `${scenario.id}: ${value} is off the slider grid`);
	}
}
// The readouts the week-one pages quote, formatted as the board formats them (three decimals).
const readoutOf = (id) => {
	const { evidence, posterior } = posteriorOf(id);
	return [formatNumber(posterior, 3), formatNumber(evidence, 3)];
};
assert.deepEqual(readoutOf('late-bus'), ['0.500', '0.150']);
assert.deepEqual(readoutOf('same-chance'), ['0.250', '0.400']);
assert.deepEqual(readoutOf('fraud-flag'), ['0.526', '0.061']);
assert.deepEqual(readoutOf('screening-test'), ['0.162', '0.117']);
assert.deepEqual(readoutOf('screening-clinic'), ['0.803', '0.355']);
// Same chance either way: P(B) is 0.4 wherever P(A) sits, because both cases give B the same chance.
for (const prior of [0.01, 0.25, 0.99]) near(bayes.computePosterior({ prior, likelihood: 0.4, falsePositive: 0.4 }).evidence, 0.4);
// Pages pick their presets; with no props the published Bayes page keeps its three, in the order its prose names them.
assert.deepEqual(bayes.resolveScenarios(), { scenarios: ['any-events', 'medical-test', 'wet-lawn'], initial: 'any-events' });
assert.deepEqual(bayes.resolveScenarios(['any-events', 'late-bus', 'same-chance', 'fraud-flag']).initial, 'any-events');
assert.deepEqual(bayes.resolveScenarios(['wet-lawn', 'any-events'], 'any-events'), { scenarios: ['wet-lawn', 'any-events'], initial: 'any-events' });
assert.throws(() => bayes.resolveScenarios(['any-events', 'late-buss']), /no example scenario "late-buss"/);
assert.throws(() => bayes.resolveScenarios(['any-events', 'toString']), /no example scenario "toString"/);
assert.throws(() => bayes.resolveScenarios(['any-events', 'wet-lawn'], 'rainy'), /initialScenario has no example scenario "rainy"/);
assert.throws(() => bayes.resolveScenarios(['any-events', 'wet-lawn'], 'late-bus'), /must be one of the scenarios/);
assert.throws(() => bayes.resolveScenarios(['wet-lawn']), /2 to 4 presets, got 1/);
assert.throws(() => bayes.resolveScenarios([]), /2 to 4 presets, got 0/);
assert.throws(() => bayes.resolveScenarios(['any-events', 'medical-test', 'wet-lawn', 'late-bus', 'fraud-flag']), /2 to 4 presets, got 5/);
assert.throws(() => bayes.resolveScenarios(['wet-lawn', 'any-events', 'wet-lawn']), /lists "wet-lawn" twice/);
// Every scenario names what its table counts.
for (const scenario of Object.values(bayes.BAYES_SCENARIOS)) assert.ok(scenario.countNoun.length > 0, `${scenario.id}: no countNoun`);
// "Show as table": the four areas as whole counts, out of the smallest of 100, 1,000 or 10,000 that keeps them whole.
// The medical test and screening tables match the ones the pages print; fraud flag is the page's "608 of 10,000".
const bayesTable = await import('../src/components/react/bayesTheorem/table.ts');
const countsOf = (id) => bayesTable.countTable(bayes.BAYES_SCENARIOS[id].values);
assert.deepEqual(countsOf('medical-test'), { population: 1000, bAndA: 9, notBAndA: 1, bAndNotA: 99, notBAndNotA: 891 });
assert.deepEqual(countsOf('screening-test'), { population: 1000, bAndA: 19, notBAndA: 1, bAndNotA: 98, notBAndNotA: 882 });
assert.deepEqual(countsOf('screening-clinic'), { population: 1000, bAndA: 285, notBAndA: 15, bAndNotA: 70, notBAndNotA: 630 });
assert.deepEqual(countsOf('late-bus'), { population: 1000, bAndA: 75, notBAndA: 175, bAndNotA: 75, notBAndNotA: 675 });
assert.deepEqual(countsOf('same-chance'), { population: 100, bAndA: 10, notBAndA: 15, bAndNotA: 30, notBAndNotA: 45 });
assert.deepEqual(countsOf('fraud-flag'), { population: 10000, bAndA: 320, notBAndA: 80, bAndNotA: 288, notBAndNotA: 9312 });
assert.deepEqual(countsOf('wet-lawn'), { population: 100, bAndA: 18, notBAndA: 2, bAndNotA: 24, notBAndNotA: 56 });
assert.deepEqual(countsOf('any-events'), { population: 100, bAndA: 24, notBAndA: 6, bAndNotA: 7, notBAndNotA: 63 });
// Every slider position gives whole counts that add up to the population, from the smallest population that can.
for (let a = 1; a <= 99; a += 1) {
	for (let b = 1; b <= 99; b += 1) {
		for (let c = 1; c <= 99; c += 1) {
			const counts = bayesTable.countTable({ prior: a / 100, likelihood: b / 100, falsePositive: c / 100 });
			const cells = [counts.bAndA, counts.notBAndA, counts.bAndNotA, counts.notBAndNotA];
			assert.ok(cells.every(Number.isInteger), `${a}, ${b}, ${c}: a count is not whole`);
			assert.equal(cells.reduce((total, count) => total + count, 0), counts.population);
			if (counts.population > 100) {
				const smaller = counts.population / 10;
				assert.ok(!cells.every((count) => Number.isInteger((count * smaller) / counts.population)), `${a}, ${b}, ${c}: ${smaller} would do`);
			}
		}
	}
}
// The slider's float steps (0.29000000000000004) still count; a value off the grid fails loudly.
assert.deepEqual(bayesTable.countTable({ prior: 0.1 + 0.19, likelihood: 0.5, falsePositive: 0.5 }), { population: 1000, bAndA: 145, notBAndA: 145, bAndNotA: 355, notBAndNotA: 355 });
assert.throws(() => bayesTable.countTable({ prior: 3 / 7, likelihood: 0.9, falsePositive: 0.3 }), /prior must be a probability on the 0.01 grid/);
assert.throws(() => bayesTable.countTable({ prior: 1.2, likelihood: 0.9, falsePositive: 0.3 }), /prior must be a probability/);
// The table's text, with commas from 1,000, and its two lines read exactly as the readout rounds them.
const medicalCopy = bayesTable.tableCopy(bayes.BAYES_SCENARIOS['medical-test'].values, bayes.BAYES_SCENARIOS['medical-test']);
assert.equal(medicalCopy.caption, 'The square as counts, out of 1,000 people');
assert.deepEqual(medicalCopy.columns, ['B', 'not B', 'Total']);
assert.deepEqual(medicalCopy.rows.map((row) => [row.header, ...row.cells.map((cell) => cell.text)]), [
	['A', '9', '1', '10'],
	['not A', '99', '891', '990'],
	['Total', '108', '892', '1,000'],
]);
assert.deepEqual(medicalCopy.rows.flatMap((row) => row.cells.filter((cell) => cell.divides).map((cell) => cell.text)), ['9', '108']);
assert.deepEqual(medicalCopy.lines.map((line) => line.text), ['P(A | B): 9 of the 108 people in B, 0.083', 'P(B): 108 of 1,000 people, 0.108']);
assert.deepEqual(medicalCopy.lines.map((line) => line.spoken), ['P of A given B: 9 of the 108 people in B, 0.083', 'P of B: 108 of 1,000 people, 0.108']);
const fraudCopy = bayesTable.tableCopy(bayes.BAYES_SCENARIOS['fraud-flag'].values, bayes.BAYES_SCENARIOS['fraud-flag']);
assert.deepEqual(fraudCopy.rows[2].cells.map((cell) => cell.text), ['608', '9,392', '10,000']);
assert.deepEqual(fraudCopy.lines.map((line) => line.text), ['P(A | B): 320 of the 608 transactions in B, 0.526', 'P(B): 608 of 10,000 transactions, 0.061']);
assert.equal(bayesTable.tableSummary(bayes.BAYES_SCENARIOS['late-bus'].values, bayes.BAYES_SCENARIOS['late-bus']), 'Out of 1,000 days, 150 are in B and 75 of those are in A.');
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
assert.throws(() => distSetups.getSetup('toString'), /unknown setup "toString"/);
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
assert.equal(balanceFresh.guess, null);
assert.equal(balanced.guess, 21, 'Balance it keeps the guess');
assert.equal(dist.reducer(balanced, { type: 'pencil', k: 9 }).guess, 21, 'a pencil move after the reveal leaves the guess');
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
assert.equal(newGame.guess, null, 'a preset clears the guess');
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

// ---- DistributionBoard copy (describe.ts) ----
const distSay = await import('../src/components/react/distributionBoard/describe.ts');
const coinValues = (values) => Object.fromEntries(['HH', 'HT', 'TH', 'TT'].map((id, index) => [id, values[index]]));
/** A state with the given values and fields, for sentences that depend on more than a few steps. */
const distAt = (setupId, values, fields = {}) => ({
	...dist.initialState(setupId),
	values: setupId === 'coins-heads' ? coinValues(values) : faceValues(values),
	activePreset: null,
	...fields,
});
const coinSteps = (values) => ['HH', 'HT', 'TH', 'TT'].flatMap((id, index) => Array.from({ length: values[index] }, () => ({ type: 'step', id, direction: 1 })));

// candy-build while covered: the card is the problem statement; nothing computed from the reader's values shows.
assert.equal(
	distSay.statusLine(buildFresh),
	'6 equally likely faces. Game card: faces 1, 2 and 3 win nothing, faces 4 and 5 win 1 candy, face 6 wins 5 candies. Set each face to match, then press Check.',
);
assert.equal(distSay.coveredText(candyBuild), 'The chart appears when your values match the card.');
assert.equal(distSay.feedbackLine(buildFresh), null);
assert.equal(distSay.feedbackLine(oneWrong), 'Not yet. Face 6 wins 4 candies; the card says 5.');
assert.equal(distSay.feedbackLine(threeWrong), "Not yet. Faces 4, 5 and 6 don't match the card.");
assert.deepEqual(distSay.readoutLines(buildFresh), []);
assert.deepEqual(distSay.tableRows(oneWrong), []);

// candy-build after the match: the merge is spelled out.
assert.equal(
	distSay.feedbackLine(cardMatched),
	'Yes, that matches the card. Three amounts are possible, 0, 1 and 5 candies, so the chart has 3 bars, not 6. They are not equally likely: 3 faces win 0, so P(X = 0) = 3/6 = 1/2, not 1/3.',
);
assert.equal(distSay.statusLine(cardMatched), '6 equally likely faces. X = candies won.');
const answerLine = distSay.feedbackLine(answerShown);
assert.equal(
	answerLine,
	'The answer: faces 1, 2 and 3 win 0, faces 4 and 5 win 1, face 6 wins 5. P(X = 0) = 3/6 = 1/2, P(X = 1) = 2/6 = 1/3, P(X = 5) = 1/6 ≈ 0.17.',
);
assert.ok(!/^Yes/.test(answerLine), 'a shown answer is not praised');
assert.deepEqual(distSay.readoutLines(cardMatched), [
	'0 candies: faces 1, 2 and 3. 3 of 6 faces, so P(X = 0) = 3/6 = 1/2 = 0.50.',
	'1 candy: faces 4 and 5. 2 of 6 faces, so P(X = 1) = 2/6 = 1/3 ≈ 0.33.',
	'5 candies: face 6. 1 of 6 faces, so P(X = 5) = 1/6 ≈ 0.17.',
	'The bars add up to 6/6 = 1.',
]);
assert.deepEqual(distSay.tableRows(cardMatched), [
	{ value: '0', members: '1, 2 and 3', probability: '3/6 = 1/2 = 0.50' },
	{ value: '1', members: '4 and 5', probability: '2/6 = 1/3 ≈ 0.33' },
	{ value: '5', members: '6', probability: '1/6 ≈ 0.17' },
]);
assert.deepEqual(distSay.tableHeaders(candyBuild), { caption: 'The bars as a table.', value: 'Value', members: 'Faces', probability: 'P(X = x)' });

// The follow-up goal, checked exactly; the faces named are the reader's own.
assert.equal(distSay.goalLine(buildFresh), null);
assert.equal(distSay.goalLine(cardMatched), 'New goal: make P(X = 1) = 1/2.');
assert.equal(distSay.goalLine(goalFrom([1, 0, 1, 0, 1, 5])), 'Yes: faces 1, 3 and 5 win 1 candy, 3 of 6 faces, so P(X = 1) = 3/6 = 1/2.');
assert.equal(distSay.goalLine(goalMissed), 'Not yet: 2 faces win 1 candy, so P(X = 1) = 2/6 = 1/3. You need 3 of the 6.');
assert.equal(distSay.goalLine(goalFrom([1, 0, 0, 0, 0, 5])), 'Not yet: 1 face wins 1 candy, so P(X = 1) = 1/6 ≈ 0.17. You need 3 of the 6.');
assert.equal(distSay.goalLine(goalFrom([1, 1, 1, 1, 0, 5])), 'Not yet: 4 faces win 1 candy, so P(X = 1) = 4/6 = 2/3. You need 3 of the 6.');

// The Symbols view, only after the match.
assert.deepEqual(distSay.symbolLines(cardMatched), []);
const symbolsView = dist.reducer(cardMatched, { type: 'stage', stage: 'symbols' });
assert.deepEqual(distSay.symbolLines(symbolsView), [
	'X(1) = 0, X(2) = 0, X(3) = 0, X(4) = 1, X(5) = 1, X(6) = 5.',
	'The event X = 0 is the set {1, 2, 3}, so P(X = 0) = P({1, 2, 3}) = 3/6.',
]);
assert.deepEqual(distSay.STAGE_LABELS, { pictures: 'Pictures', numbers: 'Numbers', symbols: 'Symbols' });
assert.deepEqual(distSay.CONTROL_LABELS, {
	check: 'Check', showAnswer: 'Show the answer', showAs: 'Show as', pencil: 'Pencil position',
	balance: 'Balance it', spread: 'Show the spread', presets: 'Presets', checkGoal: 'Check goal',
});

// coins-heads: the same pattern in the "X = k" form.
const coinsFresh = dist.initialState('coins-heads');
const coinsSetup = distSetups.getSetup('coins-heads');
assert.equal(distSay.statusLine(coinsFresh), '4 equally likely outcomes. Let X count the heads. Set X for each outcome, then press Check.');
assert.equal(distSay.statusLine(coinsMatched), '4 equally likely outcomes. X = number of heads.');
assert.equal(distSay.coveredText(coinsSetup), 'The chart appears when every outcome has its number of heads.');
const coinsOneWrong = distRun('coins-heads', ...coinSteps([2, 0, 1, 0]), { type: 'check' });
assert.equal(distSay.feedbackLine(coinsOneWrong), 'Not yet. HT has 1 head; you set X = 0.');
const coinsHhWrong = distRun('coins-heads', ...coinSteps([1, 1, 1, 0]), { type: 'check' });
assert.equal(distSay.feedbackLine(coinsHhWrong), 'Not yet. HH has 2 heads; you set X = 1.');
const coinsTwoWrong = distRun('coins-heads', ...coinSteps([2, 0, 0, 0]), { type: 'check' });
assert.equal(distSay.feedbackLine(coinsTwoWrong), "Not yet. HT and TH don't match.");
assert.equal(distSay.feedbackLine(coinsMatched), 'Yes. X = 1 for HT and TH: 2 of 4 outcomes, so P(X = 1) = 2/4 = 1/2, not 1/3.');
const coinsShown = distRun('coins-heads', { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
assert.equal(
	distSay.feedbackLine(coinsShown),
	'The answer: X = 0 for TT, X = 1 for HT and TH, X = 2 for HH. P(X = 0) = 1/4 = 0.25, P(X = 1) = 2/4 = 1/2, P(X = 2) = 1/4 = 0.25.',
);
const coinsReadouts = distSay.readoutLines(coinsMatched);
assert.equal(coinsReadouts[0], 'X = 0: TT. 1 of 4 outcomes, so P(X = 0) = 1/4 = 0.25.');
assert.equal(coinsReadouts[1], 'X = 1: HT and TH. 2 of 4 outcomes, so P(X = 1) = 2/4 = 1/2 = 0.50.');
assert.equal(coinsReadouts[2], 'X = 2: HH. 1 of 4 outcomes, so P(X = 2) = 1/4 = 0.25.');
assert.equal(coinsReadouts[3], 'The bars add up to 4/4 = 1.');
const coinsMatchPreset = dist.reducer(coinsMatched, { type: 'preset', name: 'Coins match' });
assert.equal(distSay.readoutLines(coinsMatchPreset)[1], 'X = 1: HH and TT. 2 of 4 outcomes, so P(X = 1) = 2/4 = 1/2 = 0.50.');
assert.equal(distSay.goalLine(coinsMatched), null);
assert.deepEqual(distSay.symbolLines(dist.reducer(coinsMatched, { type: 'stage', stage: 'symbols' })), [
	'X(HH) = 2, X(HT) = 1, X(TH) = 1, X(TT) = 0.',
	'The event X = 1 is the set {HT, TH}, so P(X = 1) = P({HT, TH}) = 2/4.',
]);
assert.equal(distSay.tableHeaders(coinsSetup).members, 'Outcomes');

// Rows and stepper names.
assert.equal(distSay.rowText(cardMatched, '4'), 'Face 4: 1 candy.');
assert.equal(distSay.rowText(cardMatched, '1'), 'Face 1: 0 candies.');
assert.equal(distSay.rowText(coinsMatched, 'HT'), 'HT: X = 1.');
assert.equal(distSay.stepperName(buildFresh, '4', 1), 'More candies for face 4');
assert.equal(distSay.stepperName(buildFresh, '4', -1), 'Fewer candies for face 4');
assert.equal(distSay.stepperName(coinsFresh, 'HT', 1), 'Raise X for HT');
assert.equal(distSay.stepperName(coinsFresh, 'HT', -1), 'Lower X for HT');
assert.equal(distSay.boardLabel(candyBuild), candyBuild.label);

// Refusal reasons. 'locked' means a different thing on a goal setup (presets wait for Check) and on candy-balance.
assert.equal(distSay.refusalText(candyBuild, { kind: 'below-range', id: '1' }), "A face can't win fewer than 0 candies.");
assert.equal(distSay.refusalText(candyBuild, { kind: 'above-range', id: '1' }), '6 candies is the most this board shows.');
assert.equal(distSay.refusalText(coinsSetup, { kind: 'below-range', id: 'HT' }), "An outcome can't have fewer than 0 heads.");
assert.equal(distSay.refusalText(coinsSetup, { kind: 'above-range', id: 'HT' }), 'X = 2 is the most this board shows.');
assert.equal(distSay.refusalText(candyBalance, { kind: 'locked', id: '1' }), 'Press Balance it first, then change the values.');
assert.equal(distSay.refusalText(candyBalance, { kind: 'parked' }), 'Move the pencil under the bars first.');
assert.equal(distSay.refusalText(candyBuild, { kind: 'locked' }), 'The presets open once Check passes.');
assert.equal(distSay.refusalText(distSetups.getSetup('candy-spread'), { kind: 'not-editable', id: '1' }), 'These values are fixed. Switch presets to compare.');

// Announcements: a step says the face's new value; once uncovered it adds the bar it joined.
const stepAction = { type: 'step', id: '4', direction: 1 };
assert.equal(distSay.announcementFor(dist.reducer(buildFresh, stepAction), stepAction), 'Face 4 wins 1 candy.');
const uncoveredStep = dist.reducer({ ...cardMatched, values: faceValues([0, 0, 0, 0, 1, 5]) }, stepAction);
assert.equal(distSay.announcementFor(uncoveredStep, stepAction), 'Face 4 wins 1 candy. The 1-candy bar now holds faces 4 and 5. P(X = 1) = 2/6 = 1/3.');
const coinStep = { type: 'step', id: 'HT', direction: 1 };
assert.equal(distSay.announcementFor(dist.reducer(coinsFresh, coinStep), coinStep), 'X = 1 for HT.');
// A refused action says only why.
assert.equal(distSay.announcementFor(belowRange, { type: 'step', id: '1', direction: -1 }), "A face can't win fewer than 0 candies.");
assert.equal(distSay.announcementFor(aboveRange, { type: 'step', id: '1', direction: 1 }), '6 candies is the most this board shows.');
const lockedStep = dist.reducer(balanceFresh, { type: 'step', id: '1', direction: 1 });
assert.equal(distSay.announcementFor(lockedStep, { type: 'step', id: '1', direction: 1 }), 'Press Balance it first, then change the values.');
assert.equal(distSay.announcementFor(dist.reducer(buildFresh, { type: 'preset', name: 'Game card' }), { type: 'preset', name: 'Game card' }), 'The presets open once Check passes.');
// The second wrong Check says the answer can now be shown; a match also states the new goal.
const twoWrong = distRun('candy-build', { type: 'check' }, { type: 'check' });
assert.equal(distSay.announcementFor(twoWrong, { type: 'check' }), "Not yet. Faces 4, 5 and 6 don't match the card. You can now show the answer.");
assert.equal(distSay.announcementFor(cardMatched, { type: 'check' }), `${distSay.feedbackLine(cardMatched)} New goal: make P(X = 1) = 1/2.`);
assert.equal(distSay.announcementFor(goalMissed, { type: 'check-goal' }), distSay.goalLine(goalMissed));
assert.equal(distSay.announcementFor(symbolsView, { type: 'stage', stage: 'symbols' }), distSay.symbolLines(symbolsView).join(' '));
assert.equal(distSay.announcementFor(dist.reducer(cardMatched, { type: 'stage', stage: 'pictures' }), { type: 'stage', stage: 'pictures' }), 'Showing pictures.');
assert.equal(distSay.announcementFor(buildFresh, { type: 'reset' }), 'Board reset.');

// candy-balance: the status, the new game, and the pencil.
assert.equal(
	distSay.statusLine(balanceFresh),
	'6 equally likely faces. X = candies won. Slide the pencil to where you think the bars balance, then press Balance it.',
);
assert.equal(distSay.announcementFor(newGame, { type: 'preset', name: 'One big prize' }), 'New game. Slide the pencil and press Balance it.');
assert.equal(distSay.announcementFor(parkedBalance, { type: 'balance' }), 'Move the pencil under the bars first.');
assert.equal(distSay.formatPencil(candyBalance, 7), '1.17');
assert.equal(distSay.formatPencil(candyBalance, -3), '−0.50');
assert.equal(distSay.describePencil(candyBalance, 7), 'pencil at 1.17 candies');
assert.equal(distSay.balanceLine(balanceFresh), null);
assert.equal(distSay.balanceLine(pencilMoved), null, 'no verdict before Balance it');
assert.deepEqual(distSay.meanLines(pencilMoved), []);
assert.equal(distSay.pencilLine(pencilMoved), null);
assert.equal(distSay.announcementFor(pencilMoved, { type: 'pencil', k: 21 }), 'Pencil at 3.50 candies.');

/** candy-balance after Balance it, with the given preset's values and the pencil at k. */
const balancedAt = (preset, k) => distAt('candy-balance', distSetups.PRESETS[preset], { activePreset: preset, pencil: k, guess: k, revealed: true });
assert.equal(distSay.balanceLine(balancedAt('Plain die', 21)), 'Balanced: your pencil at 3.50 is right under the mean, μ = 7/2 = 3.5 candies.');
assert.equal(distSay.statusLine(balancedAt('Plain die', 21)), '6 equally likely faces. X = candies won. The mean is μ = 7/2 = 3.5 candies.');
assert.equal(
	distSay.balanceLine(balancedAt('One big prize', 0)),
	'The plank tips down on the right. You put the pencil under the tallest bar, at 0, but the bar out at 6 sits far from the pencil and pulls harder. The balance point is μ = 1 candy.',
);
assert.equal(
	distSay.balanceLine(balancedAt('One big prize', 18)),
	'The plank tips down on the left. You put the pencil halfway between the smallest and largest amounts, at 3, but 5 of the 6 faces sit at 0. The balance point is μ = 1 candy.',
);
assert.equal(
	distSay.balanceLine(balancedAt('One big prize', 3)),
	'The plank tips down on the right, so the balance point is farther right. The mean is μ = 1 candy; your pencil was at 0.50.',
);
// Written from the templates (owner review in Task 7).
assert.equal(
	distSay.balanceLine(balancedAt('Lopsided', 0)),
	'The plank tips down on the right. You put the pencil under the tallest bar, at 0, but the bars farther out pull harder. The balance point is μ = 1 candy.',
);
assert.equal(
	distSay.balanceLine(balancedAt('Lopsided', 12)),
	'The plank tips down on the left. You put the pencil halfway between the smallest and largest amounts, at 2, but 5 of the 6 faces sit at or below 1. The balance point is μ = 1 candy.',
);
assert.equal(
	distSay.balanceLine(balancedAt('Lopsided', 30)),
	'The plank tips down on the left, so the balance point is farther left. The mean is μ = 1 candy; your pencil was at 5.00.',
);
assert.equal(
	distSay.balanceLine(balancedAt('Plain die', 3)),
	'The plank tips down on the right, so the balance point is farther right. The mean is μ = 7/2 = 3.5 candies; your pencil was at 0.50.',
);
assert.equal(distSay.balanceLine(balancedAt('All win 1', 6)), 'Balanced: your pencil at 1.00 is right under the mean, μ = 1 candy.');
assert.equal(
	distSay.balanceLine(balancedAt('All win 1', 0)),
	'The plank tips down on the right, so the balance point is farther right. The mean is μ = 1 candy; your pencil was at 0.00.',
);

// The verdict stays on the reader's guess when the pencil moves after the reveal; the live readout follows the pencil.
const guessedAtZero = [{ type: 'preset', name: 'One big prize' }, { type: 'pencil', k: 0 }, { type: 'balance' }, { type: 'pencil', k: 9 }].reduce(dist.reducer, balanced);
assert.equal(guessedAtZero.guess, 0);
assert.equal(guessedAtZero.pencil, 9);
assert.equal(
	distSay.balanceLine(guessedAtZero),
	'The plank tips down on the right. You put the pencil under the tallest bar, at 0, but the bar out at 6 sits far from the pencil and pulls harder. The balance point is μ = 1 candy.',
);
assert.equal(distSay.pencilLine(guessedAtZero), 'Pencil at 1.50: the bars pull 1 − 1.50 = −0.50 candies from it, so the plank tips left.');
assert.equal(
	distSay.balanceLine({ ...balancedAt('One big prize', 3), pencil: 30 }),
	'The plank tips down on the right, so the balance point is farther right. The mean is μ = 1 candy; your pencil was at 0.50.',
);

// Changing the values after the reveal drops the verdict: the old guess was about a different problem.
const editedAfterGuess = [1, 2, 3, 4, 5, 6].map(() => ({ type: 'step', id: '6', direction: -1 })).reduce(dist.reducer, guessedAtZero);
assert.equal(editedAfterGuess.guess, null);
assert.equal(editedAfterGuess.revealed, true);
assert.equal(distSay.balanceLine(editedAfterGuess), null);
assert.deepEqual(distSay.meanLines(editedAfterGuess), [
	'Average over the faces: (0 + 0 + 0 + 0 + 0 + 0) / 6 = 0 candies.',
	'The same from the bars: 0 × 1 = 0.',
]);
assert.equal(distSay.announcementFor(dist.reducer(editedAfterGuess, { type: 'balance' }), { type: 'balance' }), '');
// A second Balance it after the reveal changes nothing, so it can't replace the guess.
assert.equal(dist.reducer(guessedAtZero, { type: 'balance' }), guessedAtZero);

// The mean, two ways, once revealed.
assert.deepEqual(distSay.meanLines(balancedAt('One big prize', 0)), [
	'Average over the faces: (0 + 0 + 0 + 0 + 0 + 6) / 6 = 1 candy.',
	'The same from the bars: 0 × 5/6 + 6 × 1/6 = 1.',
]);
assert.deepEqual(distSay.meanLines(balancedAt('Plain die', 21)), [
	'Average over the faces: (1 + 2 + 3 + 4 + 5 + 6) / 6 = 21/6 = 7/2 = 3.5 candies.',
	'The same from the bars: 1 × 1/6 + 2 × 1/6 + 3 × 1/6 + 4 × 1/6 + 5 × 1/6 + 6 × 1/6 = 7/2 = 3.5.',
]);
assert.deepEqual(distSay.meanLines(distAt('candy-balance', [0, 0, 0, 1, 1, 5], { pencil: 7, revealed: true })), [
	'Average over the faces: (0 + 0 + 0 + 1 + 1 + 5) / 6 = 7/6 ≈ 1.17 candies.',
	'The same from the bars: 0 × 1/2 + 1 × 1/3 + 5 × 1/6 = 7/6 ≈ 1.17.',
]);

// The live pencil readout ties the tilt to μ − c.
assert.equal(distSay.pencilLine(balancedAt('One big prize', 9)), 'Pencil at 1.50: the bars pull 1 − 1.50 = −0.50 candies from it, so the plank tips left.');
assert.equal(distSay.pencilLine(balancedAt('One big prize', 6)), 'Level: the pencil is at the mean, 1.');
assert.equal(distSay.pencilLine(balancedAt('One big prize', 3)), 'Pencil at 0.50: the bars pull 1 − 0.50 = 0.50 candies from it, so the plank tips right.');
assert.equal(distSay.pencilLine(balancedAt('One big prize', -3)), 'Pencil at −0.50: the bars pull 1 − (−0.50) = 1.50 candies from it, so the plank tips right.');
assert.equal(
	distSay.pencilLine(distAt('candy-balance', [0, 0, 0, 1, 1, 5], { pencil: 9, revealed: true })),
	'Pencil at 1.50: the bars pull 7/6 − 1.50 ≈ −0.33 candies from it, so the plank tips left.',
);
assert.equal(distSay.announcementFor(balancedAt('One big prize', 9), { type: 'pencil', k: 9 }), distSay.pencilLine(balancedAt('One big prize', 9)));
assert.equal(distSay.announcementFor(balancedAt('One big prize', 9), { type: 'balance' }), distSay.balanceLine(balancedAt('One big prize', 9)));

// candy-spread: μ from the start, the spread on request, and the ghost of the previous σ.
const spreadFresh = dist.initialState('candy-spread');
assert.equal(distSay.statusLine(spreadFresh), '6 equally likely faces. X = candies won. The mean is μ = 2 candies.');
assert.deepEqual(distSay.spreadLines(spreadFresh), []);
assert.deepEqual(distSay.spreadLines(spreadOn), [
	'Distances from the mean: 1 and 3 are 1 candy away; 2 is 0 away.',
	'Variance: (1 + 1 + 0 + 0 + 1 + 1) / 6 = 4/6 = 2/3 ≈ 0.67.',
	'Standard deviation: σ = √(2/3) ≈ 0.82 candies.',
]);
assert.deepEqual(distSay.spreadLines(ghosted), [
	'Distances from the mean: 0 and 4 are each 2 candies away.',
	'Variance: the average squared distance. (4 + 4 + 4 + 4 + 4 + 4) / 6 = 4.',
	'Standard deviation: σ = √4 = 2 candies.',
]);
const steadyOn = dist.reducer(spreadOn, { type: 'preset', name: 'Steady' });
assert.deepEqual(distSay.spreadLines(steadyOn), ['Every face wins 2 candies: nothing spreads, so the variance is 0 and σ = 0.']);
assert.equal(distSay.ghostLine(spreadOn), null);
assert.equal(distSay.ghostLine(ghosted), 'Before: σ ≈ 0.82 (Many amounts). Now: σ = 2 (All or nothing).');
assert.equal(distSay.ghostLine(dist.reducer(ghosted, { type: 'preset', name: 'Steady' })), 'Before: σ = 2 (All or nothing). Now: σ = 0 (Steady).');
assert.equal(distSay.announcementFor(ghosted, { type: 'preset', name: 'All or nothing' }), distSay.ghostLine(ghosted));
assert.equal(distSay.announcementFor(spreadOn, { type: 'spread', on: true }), distSay.spreadLines(spreadOn).join(' '));
assert.equal(distSay.announcementFor(spreadFresh, { type: 'spread', on: false }), 'Spread hidden.');
const notEditable = dist.reducer(spreadOn, { type: 'step', id: '1', direction: 1 });
assert.equal(distSay.announcementFor(notEditable, { type: 'step', id: '1', direction: 1 }), 'These values are fixed. Switch presets to compare.');

// Chart and stepper labels: the words drawn on the (hidden) chart and above the steppers.
assert.equal(distSetups.TILT_DEGREES, 6);
assert.deepEqual(distSay.stepperHeaders(candyBuild, 'numbers'), { outcome: 'Face', value: 'Candies', group: 'Candies for each face' });
assert.deepEqual(distSay.stepperHeaders(candyBuild, 'symbols'), { outcome: 'ω', value: 'X(ω)', group: 'Candies for each face' });
assert.deepEqual(distSay.stepperHeaders(distSetups.getSetup('coins-heads'), 'pictures'), { outcome: 'Outcome', value: 'X', group: 'X for each outcome' });
assert.deepEqual(distSay.chartLabels(buildFresh), { axis: 'candies', shares: [], pencil: null, mu: null, sigma: null, ghost: null, arms: [] });
assert.deepEqual(distSay.chartLabels(cardMatched), {
	axis: 'candies',
	shares: [{ value: 0, text: '3/6' }, { value: 1, text: '2/6' }, { value: 5, text: '1/6' }],
	pencil: null, mu: null, sigma: null, ghost: null, arms: [],
});
assert.equal(distSay.chartLabels(balanceFresh).pencil, 'your pencil');
assert.equal(distSay.chartLabels(balanceFresh).mu, null);
assert.equal(distSay.chartLabels(balancedAt('One big prize', 9)).mu, 'μ = 1');
assert.equal(distSay.chartLabels(balancedAt('Plain die', 21)).mu, 'μ = 3.5');
assert.equal(distSay.chartLabels(distAt('candy-balance', [0, 0, 0, 1, 1, 5], { pencil: 7, revealed: true })).mu, 'μ = 7/6');
assert.equal(distSay.chartLabels(spreadFresh).mu, 'μ = 2');
assert.equal(distSay.chartLabels(spreadFresh).sigma, null);
assert.deepEqual(distSay.chartLabels(spreadOn).arms, [{ value: 1, text: '1 away' }, { value: 3, text: '1 away' }]);
assert.equal(distSay.chartLabels(spreadOn).sigma, 'σ ≈ 0.82');
assert.equal(distSay.chartLabels(ghosted).sigma, 'σ = 2');
assert.equal(distSay.chartLabels(ghosted).ghost, 'Before: σ ≈ 0.82');
assert.deepEqual(distSay.chartLabels(ghosted).arms, [{ value: 0, text: '2 away' }, { value: 4, text: '2 away' }]);
assert.equal(distSay.chartLabels(steadyOn).sigma, 'σ = 0');
assert.deepEqual(distSay.chartLabels(steadyOn).arms, []);

// Covered strings reveal nothing computed from the reader's values: no chance, fraction, bar or membership.
const revealing = /P\(|\/| bar|holds/;
for (const setupId of ['candy-build', 'coins-heads']) {
	const opening = dist.initialState(setupId);
	assert.ok(dist.isCovered(opening), `${setupId} opens covered`);
	assert.deepEqual(distSay.readoutLines(opening), [], `${setupId}: no readouts at the opening`);
	assert.deepEqual(distSay.symbolLines(opening), [], `${setupId}: no symbols at the opening`);
	assert.deepEqual(distSay.tableRows(opening), [], `${setupId}: no table at the opening`);
	assert.deepEqual(distSay.chartLabels(opening).shares, [], `${setupId}: no bar shares at the opening`);
}
for (const [setupId, steps] of [
	['candy-build', stepsTo([0, 0, 0, 1, 1, 4])],
	['candy-build', stepsTo([1, 2, 3, 4, 5, 6])],
	['coins-heads', coinSteps([1, 1, 1, 1])],
	['coins-heads', coinSteps([2, 0, 1, 0])],
]) {
	let state = dist.initialState(setupId);
	let coveredStates = 0;
	const trailing = [{ type: 'check' }, { type: 'preset', name: 'All zero' }, { type: 'stage', stage: 'symbols' }, { type: 'step', id: setupId === 'coins-heads' ? 'HH' : '1', direction: -1 }];
	for (const action of [...steps, ...trailing]) {
		state = dist.reducer(state, action);
		assert.ok(dist.isCovered(state), `${setupId} stays covered without a match`);
		coveredStates += 1;
		// Check feedback may quote the card, so only the other announcements are held to the rule.
		const spoken = action.type === 'check' ? [] : [distSay.announcementFor(state, action)];
		for (const text of [...spoken, ...distSay.readoutLines(state), ...distSay.symbolLines(state)]) {
			assert.ok(!revealing.test(text), `${setupId} covered string reveals the grouping: ${text}`);
		}
		assert.deepEqual(distSay.tableRows(state), [], `${setupId}: no table while covered`);
		assert.deepEqual(distSay.chartLabels(state).shares, [], `${setupId}: no bar shares while covered`);
	}
	assert.ok(coveredStates > trailing.length);
}

// No sentence on any setup, preset or state uses the banned words. Built from parts so the pattern stays out of commit scans.
const bannedWords = new RegExp(['pro', 'mpt|swe', 'et'].join(''), 'i');
const outcomeIdsOf = (setup) => (setup.source === 'two-coins' ? ['HH', 'HT', 'TH', 'TT'] : ['1', '2', '3', '4', '5', '6']);
const everyAction = (setup) => [
	...outcomeIdsOf(setup).flatMap((id) => [{ type: 'step', id, direction: 1 }, { type: 'step', id, direction: -1 }]),
	...setup.presets.map((name) => ({ type: 'preset', name })),
	{ type: 'check' }, { type: 'show-answer' }, { type: 'check-goal' },
	...['pictures', 'numbers', 'symbols'].map((stage) => ({ type: 'stage', stage })),
	{ type: 'pencil', k: -3 }, { type: 'pencil', k: 6 }, { type: 'pencil', k: 18 }, { type: 'balance' },
	{ type: 'spread', on: true }, { type: 'spread', on: false }, { type: 'reset' },
];
const chartStrings = (labels) => [labels.axis, labels.pencil, labels.mu, labels.sigma, labels.ghost, ...labels.shares.map((share) => share.text), ...labels.arms.map((arm) => arm.text)];
const everyString = (state) => {
	const setup = dist.setupOf(state);
	return [
		distSay.statusLine(state), distSay.feedbackLine(state), distSay.goalLine(state), distSay.balanceLine(state),
		distSay.pencilLine(state), distSay.ghostLine(state), distSay.boardLabel(setup), distSay.coveredText(setup),
		distSay.formatPencil(setup, state.pencil), distSay.describePencil(setup, state.pencil),
		...distSay.readoutLines(state), ...distSay.symbolLines(state), ...distSay.meanLines(state), ...distSay.spreadLines(state),
		...distSay.tableRows(state).flatMap((row) => Object.values(row)), ...Object.values(distSay.tableHeaders(setup)),
		...outcomeIdsOf(setup).flatMap((id) => [distSay.rowText(state, id), distSay.stepperName(state, id, 1), distSay.stepperName(state, id, -1)]),
		...['below-range', 'above-range', 'locked', 'parked', 'not-editable'].map((kind) => distSay.refusalText(setup, { kind })),
		...Object.values(distSay.STAGE_LABELS), ...Object.values(distSay.CONTROL_LABELS),
		...['pictures', 'numbers', 'symbols'].flatMap((stage) => Object.values(distSay.stepperHeaders(setup, stage))),
		...chartStrings(distSay.chartLabels(state)),
	].filter((text) => text !== null);
};
let sweptStrings = 0;
for (const setupId of ['candy-build', 'coins-heads', 'candy-balance', 'candy-spread']) {
	const setup = distSetups.getSetup(setupId);
	const presetStates = setup.presets.map((name) =>
		distAt(setupId, distSetups.presetValues(setup, name), { activePreset: name, checked: true, revealed: true, spreadShown: true, pencil: 6, guess: setup.kind === 'balance' ? 6 : null, goal: setup.goalAfterCard ? 'open' : null }),
	);
	const starts = [dist.initialState(setupId), ...presetStates];
	if (setup.card) starts.push(distRun(setupId, { type: 'check' }, { type: 'check' }, { type: 'show-answer' }));
	for (const start of starts) {
		for (const action of everyAction(setup)) {
			const next = dist.reducer(start, action);
			for (const state of [next, dist.reducer(next, action)]) {
				if (setup.kind === 'goal') {
					const labels = distSay.chartLabels(state);
					assert.ok(labels.mu === null && labels.sigma === null, `${setupId}: no μ or σ before they are taught`);
				}
				for (const text of [...everyString(state), distSay.announcementFor(state, action)]) {
					assert.equal(typeof text, 'string');
					assert.ok(!bannedWords.test(text), `${setupId} after ${action.type}: ${text}`);
					sweptStrings += 1;
				}
			}
		}
	}
}
assert.ok(sweptStrings > 1000, `swept ${sweptStrings} strings`);

// ---- Shared guided pieces (guided/guided.ts and guided/announcer.ts, decision 0013) ----
const guided = await import('../src/components/react/guided/guided.ts');
const { createAnnouncer, REANNOUNCE_GAP_MS } = await import('../src/components/react/guided/announcer.ts');

// Check: a retry Check counts misses until it passes; a one-shot Check reveals on any answer.
const notChecked = { checked: false, failedChecks: 0 };
assert.equal(guided.CHECKS_BEFORE_ANSWER, 2);
assert.deepEqual(guided.recordCheck(notChecked, true, 'retry'), { checked: true, failedChecks: 0 });
assert.deepEqual(guided.recordCheck(notChecked, false, 'retry'), { checked: false, failedChecks: 1 });
assert.deepEqual(guided.recordCheck({ checked: false, failedChecks: 1 }, true, 'retry'), { checked: true, failedChecks: 1 });
assert.deepEqual(guided.recordCheck(notChecked, false, 'once'), { checked: true, failedChecks: 1 });
assert.deepEqual(guided.recordCheck(notChecked, true, 'once'), { checked: true, failedChecks: 0 });
// Checking again after a pass is a reducer bug, so it fails loudly instead of counting.
assert.throws(() => guided.recordCheck({ checked: true, failedChecks: 0 }, false, 'retry'), /already passed/);

// "Show the answer" is offered after two wrong Checks, and never once the answer is in.
assert.equal(guided.canShowAnswer({ checked: false, failedChecks: 1 }), false);
assert.equal(guided.canShowAnswer({ checked: false, failedChecks: 2 }), true);
assert.equal(guided.canShowAnswer({ checked: false, failedChecks: 3 }), true);
assert.equal(guided.canShowAnswer({ checked: true, failedChecks: 2 }), false);

// Stages: none without stages; a stage that would give the answer away waits while the answer is covered.
const symbolsWait = { stages: true, waitsForCheck: ['symbols'], covered: true };
assert.equal(guided.stageAllowed('numbers', symbolsWait), true);
assert.equal(guided.stageAllowed('symbols', symbolsWait), false);
assert.equal(guided.stageAllowed('symbols', { ...symbolsWait, covered: false }), true);
assert.equal(guided.stageAllowed('numbers', { ...symbolsWait, stages: false, covered: false }), false);

// The announcer empties the live region, then refills it a moment later, so a repeated message is spoken again.
const fakeClock = () => {
	let now = 0;
	let nextId = 1;
	const timers = new Map();
	return {
		setTimeout: (run, ms) => {
			timers.set(nextId, { run, at: now + ms });
			return nextId++;
		},
		clearTimeout: (id) => timers.delete(id),
		advance(ms) {
			const end = now + ms;
			for (;;) {
				const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
				if (!due) break;
				timers.delete(due[0]);
				now = due[1].at;
				due[1].run();
			}
			now = end;
		},
		pending: () => timers.size,
	};
};
const announcerRun = () => {
	const clock = fakeClock();
	const shown = [];
	return { clock, shown, announcer: createAnnouncer((text) => shown.push(text), clock) };
};
{
	const { clock, shown, announcer } = announcerRun();
	announcer.announce('P(A) = 3/4.');
	clock.advance(0);
	assert.deepEqual(shown, ['']);
	clock.advance(REANNOUNCE_GAP_MS);
	assert.deepEqual(shown, ['', 'P(A) = 3/4.']);
	announcer.announce('P(A) = 3/4.');
	clock.advance(REANNOUNCE_GAP_MS);
	assert.deepEqual(shown, ['', 'P(A) = 3/4.', '', 'P(A) = 3/4.']);
}
{
	// A burst waits for its pause, and a newer message replaces one still waiting: only the last is spoken.
	const { clock, shown, announcer } = announcerRun();
	announcer.announce('Marked 1.', 600);
	clock.advance(300);
	announcer.announce('Marked 2.', 600);
	clock.advance(599);
	assert.deepEqual(shown, []);
	clock.advance(1 + REANNOUNCE_GAP_MS);
	assert.deepEqual(shown, ['', 'Marked 2.']);
}
{
	// A button pressed between emptying and refilling wins; the older text never appears.
	const { clock, shown, announcer } = announcerRun();
	announcer.announce('Old.');
	clock.advance(REANNOUNCE_GAP_MS / 2);
	announcer.announce('New.');
	clock.advance(REANNOUNCE_GAP_MS * 2);
	assert.deepEqual(shown, ['', '', 'New.']);
}
{
	// Unmounting cancels whatever is still waiting.
	const { clock, shown, announcer } = announcerRun();
	announcer.announce('Never said.', 600);
	announcer.cancel();
	assert.equal(clock.pending(), 0);
	clock.advance(1000);
	assert.deepEqual(shown, []);
}

// ---- DescriptiveStats model and datasets (decision 0015) ----
// Exact statistics on short whole-number lists. Quantiles are NumPy's default "linear" method, variance divides by n
// (σ) or by n − 1 (s), Tukey fences sit 1.5 × IQR past the quartiles with a strict test.
{
	const dm = await import('../src/components/react/descriptiveStats/model.ts');
	const dd = await import('../src/components/react/descriptiveStats/datasets.ts');
	const f = fraction;
	const rootText = (root) => (root.exact ? formatFraction(root.value) : `≈ ${root.value.toFixed(2)}`);
	const zText = (root) => (root.exact ? formatFraction(root.value) : root.value.toFixed(2));
	const klass = dd.CLASS_HEIGHTS;

	// Our class: 9 children, numbered in the order they arrived.
	assert.deepEqual(klass, [133, 122, 140, 128, 148, 125, 137, 131, 142]);
	assert.deepEqual(dm.sortedValues(klass), [122, 125, 128, 131, 133, 137, 140, 142, 148]);
	assert.deepEqual(klass, [133, 122, 140, 128, 148, 125, 137, 131, 142], 'sortedValues leaves its input alone');
	assert.equal(dm.sum(klass), 1206);
	assert.deepEqual(dm.mean(klass), f(134, 1));
	assert.deepEqual(dm.median(klass), f(133, 1));
	assert.deepEqual(dm.modes(klass), []);
	assert.equal(dm.range(klass), 26);
	assert.deepEqual(dm.midrange(klass), f(135, 1));
	assert.deepEqual(dm.quartiles(klass), { q1: f(128, 1), median: f(133, 1), q3: f(140, 1) });
	assert.deepEqual(dm.iqr(klass), f(12, 1));
	assert.deepEqual(dm.fences(klass), { lower: f(110, 1), upper: f(158, 1) });
	assert.deepEqual(dm.populationVariance(klass), f(64, 1));
	assert.deepEqual(dm.sampleVariance(klass), f(72, 1));
	assert.deepEqual(dm.populationSD(klass), { exact: true, value: f(8, 1) });
	assert.equal(rootText(dm.sampleSD(klass)), '≈ 8.49');
	assert.deepEqual(dm.rankOf(klass, 4), { shorter: 8, taller: 0, same: 0 });
	assert.deepEqual(dm.rankOf(klass, 6), { shorter: 5, taller: 3, same: 0 });
	assert.deepEqual(dm.rankOf(klass, 0), { shorter: 4, taller: 4, same: 0 });
	assert.deepEqual(dm.iqrFlags(klass), klass.map(() => false));
	assert.deepEqual(dm.middleIndices(klass), [0], 'child 1 is the one middle child');
	assert.equal(dm.middleCount(klass), 1);

	// Line-up presets. Ten children: our class and a tenth child of 136 cm, so the median falls between two children.
	const ten = dd.CLASS_OF_TEN;
	assert.deepEqual(ten, [133, 122, 140, 128, 148, 125, 137, 131, 142, 136]);
	assert.equal(dm.sum(ten), 1342);
	assert.deepEqual(dm.mean(ten), f(671, 5), 'mean 134.2');
	assert.deepEqual(dm.median(ten), f(269, 2), 'median 134.5, a height nobody has');
	assert.ok(!ten.includes(134.5));
	assert.deepEqual(dm.middleIndices(ten), [0, 9], 'child 1 (133 cm) and child 10 (136 cm)');
	assert.equal(dm.middleCount(ten), 2);
	assert.deepEqual(dm.rankOf(ten, 0), { shorter: 4, taller: 5, same: 0 });
	assert.deepEqual(dm.rankOf(ten, 9), { shorter: 5, taller: 4, same: 0 });
	assert.deepEqual(dm.modes(ten), []);
	assert.equal(dm.range(ten), 26);
	// Shared heights: two heights held by 2 children each, kept away from the middle child.
	const shared = dd.SHARED_HEIGHTS;
	assert.deepEqual(dm.sortedValues(shared), [123, 127, 127, 130, 132, 136, 141, 141, 149]);
	assert.equal(dm.sum(shared), 1206);
	assert.deepEqual(dm.mean(shared), f(134, 1));
	assert.deepEqual(dm.median(shared), f(132, 1));
	assert.deepEqual(dm.modes(shared), [127, 141]);
	assert.equal(dm.topCount(shared), 2);
	assert.equal(dm.range(shared), 26);
	assert.deepEqual(dm.middleIndices(shared), [6], 'child 7 (132 cm)');
	assert.deepEqual(dm.rankOf(shared, 1), { shorter: 1, taller: 6, same: 1 });
	// A tie in the middle leaves no single middle child, or only one of an even pair.
	assert.deepEqual(dm.middleIndices([131, 133, 133, 137, 140]), []);
	assert.deepEqual(dm.middleIndices([122, 133, 133, 140]), []);
	assert.deepEqual(dm.middleIndices([122, 130, 133, 133, 140, 145]), [], 'a tie at one of the two middle places');

	// The tight class has the same mean and median, two modes and a quarter of the variance.
	const tight = dd.TIGHT_CLASS;
	assert.deepEqual(dm.mean(tight), f(134, 1));
	assert.deepEqual(dm.median(tight), f(134, 1));
	assert.deepEqual(dm.modes(tight), [130, 138]);
	assert.deepEqual(dm.populationVariance(tight), f(16, 1));
	assert.deepEqual(dm.populationSD(tight), { exact: true, value: f(4, 1) });
	assert.deepEqual(dm.sampleVariance(tight), f(18, 1));
	assert.equal(rootText(dm.sampleSD(tight)), '≈ 4.24');
	assert.deepEqual(dm.populationSD(dd.EVERYONE_134), { exact: true, value: f(0, 1) });
	assert.deepEqual(dm.modes(dd.EVERYONE_134), [], 'every value appears equally often, so there is no mode');

	// One very tall child: 148 becomes 162, and the quartiles and fences stay put.
	assert.deepEqual(dd.CLASS_TALL, [133, 122, 140, 128, 162, 125, 137, 131, 142]);
	assert.deepEqual(dm.quartiles(dd.CLASS_TALL), { q1: f(128, 1), median: f(133, 1), q3: f(140, 1) });
	assert.deepEqual(dm.fences(dd.CLASS_TALL), { lower: f(110, 1), upper: f(158, 1) });
	assert.deepEqual(dm.iqrFlags(dd.CLASS_TALL), [false, false, false, false, true, false, false, false, false]);

	// The cafe: a millionaire moves the mean far more than the median, and the mode not at all.
	const cafe = dd.CAFE_SAVINGS;
	assert.deepEqual(cafe, [1, 2, 3, 4, 4, 5, 5, 5, 7]);
	assert.deepEqual(dm.mean(cafe), f(4, 1));
	assert.deepEqual(dm.median(cafe), f(4, 1));
	assert.deepEqual(dm.modes(cafe), [5]);
	assert.equal(dm.topCount(cafe), 3);
	const millionaire = [...cafe, 1000];
	assert.deepEqual(dm.mean(millionaire), f(518, 5));
	assert.deepEqual(dm.median(millionaire), f(9, 2));
	assert.deepEqual(dm.quartiles(millionaire).q1, f(13, 4));
	assert.deepEqual(dm.modes(millionaire), [5]);
	assert.deepEqual(dm.mean([...cafe, 6]), f(21, 5));
	assert.deepEqual(dm.median([...cafe, 6]), f(9, 2));
	assert.deepEqual(dm.modes([...cafe, 4]), [4, 5]);

	// Quantiles: NumPy's linear method, h = (n − 1) p, exact.
	assert.deepEqual(dm.quantile([1, 2, 3, 4], f(1, 4)), f(7, 4));
	assert.deepEqual(dm.quantile([1, 2, 3, 4], f(1, 2)), f(5, 2));
	assert.deepEqual(dm.quantile([5], f(3, 4)), f(5, 1));
	assert.deepEqual(dm.quantile(klass, f(0, 1)), f(122, 1));
	assert.deepEqual(dm.quantile(klass, f(1, 1)), f(148, 1));
	assert.throws(() => dm.quantile(klass, f(5, 4)), /quantile.*5\/4/);
	assert.throws(() => dm.mean([]), /empty/);
	assert.throws(() => dm.mean([1, 2.5]), /whole numbers.*2\.5/);
	assert.throws(() => dm.sampleVariance([5]), /two values/);
	assert.throws(() => dm.sum([2 ** 52, 2 ** 52]), /safe integers/);

	// Scaling two tests: min–max and z disagree about where Ana did better.
	const testA = dd.TEST_A.values;
	const testB = dd.TEST_B.values;
	assert.equal(testA[dd.TEST_A.ana], 36);
	assert.equal(testB[dd.TEST_B.ana], 58);
	assert.deepEqual(dm.mean(testA), f(30, 1));
	assert.deepEqual(dm.populationSD(testA), { exact: true, value: f(6, 1) });
	assert.deepEqual(dm.mean(testB), f(50, 1));
	assert.deepEqual(dm.populationSD(testB), { exact: true, value: f(8, 1) });
	assert.deepEqual(dm.minMax(36, testA), f(15, 18));
	assert.deepEqual(dm.minMax(58, testB), f(20, 26));
	assert.deepEqual(dm.zScore(36, testA), { exact: true, value: f(1, 1) });
	assert.deepEqual(dm.zScore(58, testB), { exact: true, value: f(1, 1) });
	const lowB = dd.TEST_B_LOW;
	assert.deepEqual(lowB, [10, 41, 44, 47, 49, 53, 56, 58, 64]);
	assert.deepEqual(dm.minMax(58, lowB), f(8, 9));
	assert.equal(zText(dm.zScore(58, lowB)), '0.76');
	assert.throws(() => dm.minMax(3, [3, 3, 3]), /every value is the same/);

	// The pumpkins: the second giant replaces a 7 kg pumpkin, so there are always 9.
	assert.deepEqual(dd.pumpkins(8, 1), [4, 5, 5, 6, 6, 6, 7, 7, 8]);
	assert.deepEqual(dd.pumpkins(30, 2), [4, 5, 5, 6, 6, 6, 7, 30, 30]);
	assert.throws(() => dd.pumpkins(30, 3), /1 or 2 giants/);
	const oneGiant = dd.pumpkins(30, 1);
	assert.deepEqual(dm.quartiles(oneGiant), { q1: f(5, 1), median: f(6, 1), q3: f(7, 1) });
	assert.deepEqual(dm.fences(oneGiant), { lower: f(2, 1), upper: f(10, 1) });
	assert.equal(rootText(dm.populationSD(oneGiant)), '≈ 7.68');
	assert.equal(toNumber(dm.mean(oneGiant)).toFixed(2), '8.44');
	assert.equal(zText(dm.zScore(30, oneGiant)), '2.81');
	assert.deepEqual(dm.zFlags(oneGiant, 2), [false, false, false, false, false, false, false, false, true]);
	assert.deepEqual(dm.zFlags(oneGiant, 3), oneGiant.map(() => false));
	// On the fence is not past it: at 10 kg the IQR rule stays quiet while |z| > 2 flags; at 11 kg both flag.
	assert.equal(dm.iqrFlags(dd.pumpkins(10, 1))[8], false);
	assert.equal(zText(dm.zScore(10, dd.pumpkins(10, 1))), '2.34');
	assert.equal(dm.zFlags(dd.pumpkins(10, 1), 2)[8], true);
	assert.equal(dm.iqrFlags(dd.pumpkins(11, 1))[8], true);
	// Masking: with σ dividing by n, no |z| among n values can reach √(n − 1) = √8 ≈ 2.83, so |z| > 3 never flags.
	for (let giant = 8; giant <= 60; giant += 1) {
		const z = dm.zScore(giant, dd.pumpkins(giant, 1));
		const value = z.exact ? toNumber(z.value) : z.value;
		assert.ok(value < Math.sqrt(8) && value <= 3, `giant ${giant} kg: z = ${value}`);
	}
	assert.equal(dm.zScore(15, dd.pumpkins(15, 1)).value.toFixed(2), '2.70', 'above 8/3, the bound for the sample s, not σ');
	// Two giants hide each other: mean 11, σ ≈ 10.19, each z ≈ 1.87, yet both are past the IQR fence.
	const twoGiants = dd.pumpkins(30, 2);
	assert.deepEqual(dm.mean(twoGiants), f(11, 1));
	assert.equal(rootText(dm.populationSD(twoGiants)), '≈ 10.19');
	assert.equal(zText(dm.zScore(30, twoGiants)), '1.87');
	assert.deepEqual(dm.zFlags(twoGiants, 2), twoGiants.map(() => false));
	assert.deepEqual(dm.iqrFlags(twoGiants), [false, false, false, false, false, false, false, true, true]);
	// No giant: nothing is flagged, and the largest |z| is ≈ 1.73.
	const noGiant = dd.pumpkins(8, 1);
	assert.deepEqual(dm.iqrFlags(noGiant), noGiant.map(() => false));
	assert.equal(Math.max(...noGiant.map((value) => Math.abs(dm.zScore(value, noGiant).value))).toFixed(2), '1.73');
	assert.throws(() => dm.zScore(134, dd.EVERYONE_134), /σ is 0/);
}

// ---- DescriptiveStats setups, layout and state ----
{
	const dl = await import('../src/components/react/descriptiveStats/layout.ts');
	const ds = await import('../src/components/react/descriptiveStats/setups.ts');
	const dst = await import('../src/components/react/descriptiveStats/state.ts');
	const dd = await import('../src/components/react/descriptiveStats/datasets.ts');
	const guidedModule = await import('../src/components/react/guided/guided.ts');
	const run = (setupId, ...actions) => actions.reduce(dst.reducer, dst.initialState(setupId));

	// Layout: ties stack, near neighbors at 320px step up, and the layout never depends on the screen.
	const cafeAxis = ds.getSetup('cafe-millionaire').axis;
	assert.deepEqual(dl.stackRows([5, 4, 5, 5, 7], cafeAxis), [0, 0, 1, 2, 0]);
	assert.equal(dl.stackHeight(dd.CAFE_SAVINGS, cafeAxis), 3, 'the mode is the tallest stack');
	assert.equal(dl.stackHeight(dd.CLASS_HEIGHTS, ds.getSetup('class-lineup').axis), 1, 'no class heights touch');
	assert.equal(dl.stackHeight(dd.pumpkins(8, 1), ds.getSetup('pumpkin-outliers').axis), 5, '1 kg apart is under a dot width at 320px');
	assert.equal(dl.across({ min: 110, max: 160, tickStep: 5, narrowTickStep: 10 }, 135), 50);
	assert.deepEqual(dl.ticks({ min: 110, max: 130, tickStep: 5, narrowTickStep: 10 }).map((tick) => `${tick.value}${tick.narrow ? '*' : ''}`), ['110*', '115', '120*', '125', '130*']);

	// Setup validation names the setup and the cause.
	assert.throws(() => ds.getSetup('class-line-up'), /unknown setup "class-line-up"/);
	assert.throws(() => ds.getSetup('toString'), /unknown setup "toString"/);
	for (const id of ds.SETUP_IDS) assert.equal(ds.getSetup(id).id, id);
	assert.deepEqual(ds.SETUP_IDS, ['class-lineup', 'cafe-millionaire', 'class-spread', 'class-box', 'marks-scaling', 'pumpkin-outliers']);
	const box = ds.getSetup('class-box');
	assert.throws(() => ds.validateSetup({ ...box, presets: [{ id: 'ten', label: 'Ten children', values: [...dd.CLASS_HEIGHTS, 130] }] }), /"class-box".*"Ten children".*4k \+ 1.*10/);
	const spread = ds.getSetup('class-spread');
	// The slider must stay on the chart unless the setup declares an off-chart lane.
	assert.throws(() => ds.validateSetup({ ...spread, slider: { ...spread.slider, max: 170 } }), /"class-spread".*170 is past the axis.*no off-chart lane/);
	assert.throws(() => ds.validateSetup({ ...spread, slider: { ...spread.slider, min: 100 } }), /"class-spread".*100 is below the axis/);
	assert.throws(() => ds.validateSetup({ ...spread, presets: [{ id: 'x', label: 'Too tall', values: dd.CLASS_TALL }] }), /"class-spread".*"Too tall".*162 is past the axis/);
	assert.throws(() => ds.validateSetup({ ...spread, slider: { ...spread.slider, max: 145 } }), /"class-spread" preset "Our class": 148 is outside the slider's 110 to 145/);
	assert.throws(() => ds.validateSetup({ ...spread, opening: dd.TIGHT_CLASS.map((h) => h + 1) }), /"class-spread".*mean 135.*134/);
	const pumpkinSetup = ds.getSetup('pumpkin-outliers');
	assert.ok(pumpkinSetup.lane && pumpkinSetup.slider.max > pumpkinSetup.axis.max, 'the giant can pass 30 kg only because the setup has a lane');
	assert.throws(() => ds.validateSetup({ ...pumpkinSetup, lane: false }), /"pumpkin-outliers".*60 is past the axis, which ends at 30/);
	// 320px spacing: on a 0–60 kg axis the ordinary pumpkins, 1 kg apart, could not be told apart.
	assert.throws(() => ds.validateSetup({ ...pumpkinSetup, axis: { min: 0, max: 60, tickStep: 10, narrowTickStep: 20 } }), /"pumpkin-outliers" the opening: 4 and 5 sit 4\.2px apart at 320px/);
	// A line-up class may be even in number or repeat heights, but no two children may tie in the middle.
	const lineupSetup = ds.getSetup('class-lineup');
	assert.deepEqual(lineupSetup.presets.map((preset) => preset.id), ['our-class', 'ten-children', 'shared-heights']);
	assert.ok(ds.validateSetup({ ...lineupSetup, opening: dd.CLASS_OF_TEN }));
	assert.throws(() => ds.validateSetup({ ...lineupSetup, opening: dd.CLASS_HEIGHTS.map((h) => (h === 131 ? 133 : h)) }), /"class-lineup" the opening: the middle height must belong to one child/);
	assert.throws(
		() => ds.validateSetup({ ...lineupSetup, presets: [{ id: 'tie', label: 'Tied pair', values: dd.CLASS_OF_TEN.map((h) => (h === 136 ? 133 : h)) }] }),
		/"class-lineup" preset "Tied pair": the two middle heights must each belong to one child/,
	);
	assert.throws(() => ds.validateSetup({ ...lineupSetup, presets: [{ id: 'nobody', label: 'Nobody', newcomer: null }] }), /"class-lineup" has a preset without a class/);
	assert.throws(() => ds.validateSetup({ ...ds.getSetup('class-lineup'), waitsForCheck: ['box'] }), /"class-lineup".*stage "box"/);
	assert.throws(() => ds.validateSetup({ ...spread, waitsForCheck: ['symbols'] }), /"class-spread".*only line-up setups have a Check/);
	assert.throws(() => ds.validateSetup({ ...spread, presets: [...spread.presets, ...box.presets.map((p) => ({ ...p, id: `${p.id}-2` }))] }), /"class-spread".*5 presets/);
	assert.throws(() => ds.validateSetup({ ...ds.getSetup('cafe-millionaire'), presets: [{ id: 'rich', label: 'Richer', newcomer: 2000 }] }), /"cafe-millionaire".*"Richer".*2000 is outside the slider's 0 to 1000/);
	assert.throws(() => ds.validateSetup({ ...ds.getSetup('marks-scaling'), anaB: 12 }), /"marks-scaling".*Ana's mark on test B is missing/);
	assert.throws(() => ds.validateSetup({ ...box, axis: { min: 110, max: 170, tickStep: 7, narrowTickStep: 10 } }), /"class-box".*ticks don't fit/);

	// class-lineup: the summary is covered until Check finds the middle child.
	const lineupOpen = dst.initialState('class-lineup');
	assert.equal(lineupOpen.stage, 'pictures');
	assert.equal(dst.isCovered(lineupOpen), true);
	assert.equal(dst.stageAllowed(lineupOpen, 'symbols'), false, 'Symbols waits for Check');
	assert.equal(dst.stageAllowed(lineupOpen, 'numbers'), true);
	assert.equal(dst.reducer(lineupOpen, { type: 'stage', stage: 'symbols' }).stage, 'pictures', 'a held-back stage is ignored');
	assert.deepEqual(dst.middleChildren(dd.CLASS_HEIGHTS), [0]);
	assert.deepEqual(dst.middleChildren(dd.CLASS_OF_TEN), [0, 9], 'shortest first');
	assert.deepEqual(dst.middleChildren(dd.SHARED_HEIGHTS), [6]);
	assert.throws(() => dst.middleChildren([131, 133, 133, 137, 140]), /tie in the middle/);
	assert.equal(lineupOpen.activePreset, 'our-class', 'the opening class is the first preset');
	assert.deepEqual(run('class-lineup', { type: 'check' }).refusal, { kind: 'no-pick' });
	assert.equal(run('class-lineup', { type: 'check' }).failedChecks, 0, 'a refused Check is not a miss');
	const wrongFive = run('class-lineup', { type: 'pick', child: 4 }, { type: 'check' });
	assert.deepEqual(wrongFive.feedback, { kind: 'wrong', child: 4 });
	assert.equal(wrongFive.failedChecks, 1);
	assert.equal(dst.isCovered(wrongFive), true);
	assert.equal(dst.reducer(wrongFive, { type: 'pick', child: 6 }).feedback, null, 'a new pick clears the old verdict');
	const twoWrong = dst.reducer(dst.reducer(wrongFive, { type: 'pick', child: 6 }), { type: 'check' });
	assert.equal(guidedModule.canShowAnswer(twoWrong), true);
	const shown = dst.reducer(twoWrong, { type: 'show-answer' });
	assert.deepEqual(shown.feedback, { kind: 'shown', child: 0 });
	assert.equal(shown.checked, true);
	assert.equal(shown.pick, 0);
	assert.equal(dst.reducer(wrongFive, { type: 'show-answer' }), wrongFive, 'no answer after one miss');
	const right = run('class-lineup', { type: 'line-up', on: true }, { type: 'pick', child: 0 }, { type: 'check' });
	assert.deepEqual(right.feedback, { kind: 'right', child: 0 });
	assert.equal(dst.isCovered(right), false);
	assert.equal(dst.stageAllowed(right, 'symbols'), true);
	assert.equal(dst.reducer(right, { type: 'check' }), right, 'Check is ignored once it has passed');
	assert.equal(dst.reducer(right, { type: 'pick', child: 3 }), right, 'the pick is locked after Check');

	// A line-up preset is a new class: it arrives unsorted and covered, and its hunt starts from scratch.
	const solvedOnSymbols = dst.reducer(right, { type: 'stage', stage: 'symbols' });
	assert.equal(solvedOnSymbols.stage, 'symbols');
	const tenLoaded = dst.reducer(solvedOnSymbols, { type: 'preset', id: 'ten-children' });
	assert.deepEqual(tenLoaded.values, dd.CLASS_OF_TEN);
	assert.equal(tenLoaded.activePreset, 'ten-children');
	assert.equal(dst.isCovered(tenLoaded), true, 'the new class is covered again');
	assert.equal(tenLoaded.linedUp, false, 'the new class arrives unsorted');
	assert.equal(tenLoaded.pick, null);
	assert.equal(tenLoaded.feedback, null);
	assert.equal(tenLoaded.failedChecks, 0);
	assert.equal(tenLoaded.stage, 'pictures', 'Symbols waits for Check again, so the board goes back to the opening stage');
	assert.equal(dst.reducer(dst.reducer(right, { type: 'stage', stage: 'numbers' }), { type: 'preset', id: 'shared-heights' }).stage, 'numbers', 'an allowed stage stays');
	const twoMissesThenPreset = run('class-lineup', { type: 'pick', child: 4 }, { type: 'check' }, { type: 'check' }, { type: 'preset', id: 'shared-heights' });
	assert.equal(guidedModule.canShowAnswer(twoMissesThenPreset), false, 'misses on one class do not offer the answer on the next');
	assert.equal(dst.reducer(tenLoaded, { type: 'preset', id: 'ten-children' }), tenLoaded, 'pressing the class in view changes nothing');
	assert.equal(dst.reducer(right, { type: 'preset', id: 'our-class' }), right, 'nor does pressing it after Check');
	// Ten children: either middle child is right; "Show the answer" names the shorter one and the verdict both.
	assert.equal(dst.reducer(dst.reducer(tenLoaded, { type: 'pick', child: 0 }), { type: 'check' }).checked, true);
	assert.equal(dst.reducer(dst.reducer(tenLoaded, { type: 'pick', child: 9 }), { type: 'check' }).checked, true);
	assert.equal(dst.reducer(dst.reducer(tenLoaded, { type: 'pick', child: 4 }), { type: 'check' }).checked, false);
	const tenShown = [{ type: 'pick', child: 4 }, { type: 'check' }, { type: 'check' }, { type: 'show-answer' }].reduce(dst.reducer, tenLoaded);
	assert.deepEqual(tenShown.feedback, { kind: 'shown', child: 0 });
	assert.equal(dst.reducer(tenLoaded, { type: 'pick', child: 9 }).pick, 9, 'child 10 can be picked');
	assert.equal(dst.reducer(tenLoaded, { type: 'pick', child: 10 }).pick, null, 'no child 11');
	// Shared heights: the middle child is child 7, and the twins of height are not.
	const sharedLoaded = run('class-lineup', { type: 'preset', id: 'shared-heights' });
	assert.equal(dst.reducer(dst.reducer(sharedLoaded, { type: 'pick', child: 6 }), { type: 'check' }).checked, true);
	assert.equal(dst.reducer(dst.reducer(sharedLoaded, { type: 'pick', child: 1 }), { type: 'check' }).checked, false);
	assert.deepEqual(dst.reducer(sharedLoaded, { type: 'reset' }), dst.initialState('class-lineup'), 'Reset returns to our class');

	// class-spread: presets keep the previous σ as a ghost; moving a child steps away from every preset.
	const spreadOpen = dst.initialState('class-spread');
	assert.equal(spreadOpen.activePreset, 'our-class');
	const tight = dst.reducer(spreadOpen, { type: 'preset', id: 'tight-class' });
	assert.deepEqual(tight.values, dd.TIGHT_CLASS);
	assert.deepEqual(tight.ghost, { sigma: { exact: true, value: fraction(8, 1) }, preset: 'Our class' });
	const moved = run('class-spread', { type: 'select', child: 3 }, { type: 'set-value', value: 131 });
	assert.deepEqual(moved.values, [133, 122, 140, 131, 148, 125, 137, 131, 142]);
	assert.equal(moved.activePreset, null);
	assert.equal(dst.reducer(moved, { type: 'preset', id: 'tight-class' }).ghost, null, 'no ghost for values that were not a preset');
	// A slider edit between two presets drops the old ghost, so it never names the preset that is now showing.
	const backToOurs = run('class-spread', { type: 'preset', id: 'tight-class' }, { type: 'set-value', value: 150 }, { type: 'preset', id: 'our-class' });
	assert.equal(backToOurs.activePreset, 'our-class');
	assert.equal(backToOurs.ghost, null, 'no ghost after a slider edit, even one that kept an older ghost');
	// Pressing the preset that is already showing changes nothing, so the ghost stays.
	assert.deepEqual(dst.reducer(tight, { type: 'preset', id: 'tight-class' }).ghost, tight.ghost);
	assert.equal(run('class-spread', { type: 'set-value', value: 400 }).values[0], 160, 'the slider clamps');
	assert.throws(() => run('class-spread', { type: 'set-value', value: 131.5 }), /whole number/);
	assert.equal(run('class-spread', { type: 'select', child: 9 }).selected, 0, 'no child 10');
	assert.equal(run('class-spread', { type: 'sample', on: true }).sample, true);
	assert.equal(dst.reducer(spreadOpen, { type: 'check' }), spreadOpen, 'spread setups have no Check');

	// The drag strip clamps the way the reducer does, so the value it commits is the value the board holds.
	const spreadSetup = ds.getSetup('class-spread');
	assert.equal(dst.clampToSlider(spreadSetup, spreadSetup.slider.max + 20), spreadSetup.slider.max);
	assert.equal(dst.clampToSlider(spreadSetup, spreadSetup.slider.min - 20), spreadSetup.slider.min);
	assert.equal(dst.reducer(dst.initialState('class-spread'), { type: 'set-value', value: spreadSetup.slider.max + 20 }).values[0], dst.clampToSlider(spreadSetup, spreadSetup.slider.max + 20));
	assert.throws(() => dst.clampToSlider(ds.getSetup('class-lineup'), 130), /has no slider/);

	// cafe-millionaire: the switch and the presets agree on who is in the cafe.
	const cafeOpen = dst.initialState('cafe-millionaire');
	assert.equal(cafeOpen.activePreset, 'nobody');
	assert.deepEqual(dst.valuesNow(cafeOpen), dd.CAFE_SAVINGS);
	const walksIn = dst.reducer(cafeOpen, { type: 'newcomer', on: true });
	assert.deepEqual(dst.valuesNow(walksIn), [...dd.CAFE_SAVINGS, 1000]);
	assert.equal(walksIn.activePreset, 'millionaire');
	const neighbor = dst.reducer(walksIn, { type: 'preset', id: 'neighbor' });
	assert.equal(neighbor.newcomer, 6);
	assert.equal(neighbor.activePreset, 'neighbor');
	assert.equal(dst.reducer(neighbor, { type: 'set-value', value: 7 }).activePreset, null);
	assert.equal(dst.reducer(dst.reducer(neighbor, { type: 'newcomer', on: false }), { type: 'set-value', value: 20 }).newcomer, null, 'the slider waits while nobody new is in');
	assert.equal(dst.reducer(neighbor, { type: 'preset', id: 'nobody' }).newcomer, null);
	// The switch is named for the millionaire, so it always brings 1,000, not the neighbor seen last.
	const backIn = [{ type: 'preset', id: 'nobody' }, { type: 'newcomer', on: true }].reduce(dst.reducer, neighbor);
	assert.equal(backIn.newcomer, 1000);
	assert.equal(backIn.activePreset, 'millionaire');

	// pumpkin-outliers: with two giants the slider moves both, and n stays 9.
	const twoGiants = run('pumpkin-outliers', { type: 'preset', id: 'two-giants' }, { type: 'set-value', value: 45 });
	assert.deepEqual(twoGiants.values, [4, 5, 5, 6, 6, 6, 7, 45, 45]);
	assert.equal(twoGiants.activePreset, null);
	assert.equal(run('pumpkin-outliers', { type: 'set-value', value: 30 }).activePreset, 'one-giant');
	assert.equal(run('pumpkin-outliers', { type: 'cutoff', cutoff: 3 }).cutoff, 3);
	assert.equal(run('pumpkin-outliers', { type: 'cutoff', cutoff: 4 }).cutoff, 2);
	assert.equal(dst.initialState('pumpkin-outliers').activePreset, 'no-giant');

	// marks-scaling and class-box.
	assert.deepEqual(run('marks-scaling', { type: 'preset', id: 'low-mark' }).values, dd.TEST_B_LOW);
	assert.equal(run('marks-scaling', { type: 'scale', scale: 'z' }).scale, 'z');
	assert.equal(run('class-box', { type: 'stage', stage: 'box' }).stage, 'box');
	assert.equal(run('class-box', { type: 'stage', stage: 'symbols' }).stage, 'line-up');
	assert.deepEqual(run('class-box', { type: 'stage', stage: 'box' }, { type: 'reset' }), dst.initialState('class-box'));
}

// ---- DescriptiveStats copy (describe.ts) ----
// Every readout pinned word for word, the line-up cover, and the banned words on every reachable state.
{
	const dsay = await import('../src/components/react/descriptiveStats/describe.ts');
	const ds = await import('../src/components/react/descriptiveStats/setups.ts');
	const dst = await import('../src/components/react/descriptiveStats/state.ts');
	const run = (setupId, ...actions) => actions.reduce(dst.reducer, dst.initialState(setupId));
	const lines = (state) => dsay.readoutLines(state).join(' ');

	// Number format.
	assert.equal(dsay.groupThousands(1206), '1,206');
	assert.equal(dsay.groupThousands(-1000), '−1,000');
	assert.equal(dsay.groupThousands(48), '48');
	assert.equal(dsay.amount(fraction(518, 5)), '103.6');
	assert.equal(dsay.amount(fraction(76, 9)), '≈ 8.44');
	assert.equal(dsay.equalsAmount(fraction(134, 1)), '= 134');
	assert.equal(dsay.ordinal(1), '1st');
	assert.equal(dsay.ordinal(3), '3rd');
	assert.equal(dsay.ordinal(12), '12th');
	assert.equal(dsay.ordinal(22), '22nd');

	// class-lineup: the hunt for the middle child.
	const open = dst.initialState('class-lineup');
	assert.equal(dsay.statusLine(open), '9 children, in the order they arrived. Heights from 122 cm to 148 cm.');
	assert.equal(dsay.statusLine(run('class-lineup', { type: 'line-up', on: true })), '9 children, lined up from shortest to tallest. Heights from 122 cm to 148 cm.');
	assert.equal(dsay.coveredText(), 'The summary appears when you find the middle child.');
	assert.equal(dsay.checkRefusal(open), 'Pick a child under Your middle child first.');
	assert.equal(
		dsay.feedbackLine(run('class-lineup', { type: 'pick', child: 4 }, { type: 'check' })),
		'Child 5 stands in the middle of the arrival line, but 8 children are shorter and none is taller. Line them up first.',
	);
	assert.equal(
		dsay.feedbackLine(run('class-lineup', { type: 'line-up', on: true }, { type: 'pick', child: 4 }, { type: 'check' })),
		'Child 5 stands in the middle of the arrival line, but 8 children are shorter and none is taller. Try a shorter child.',
	);
	// The verdict reads the line-up switch live, so "Line them up first." goes once they are lined up.
	assert.equal(
		dsay.feedbackLine(run('class-lineup', { type: 'pick', child: 4 }, { type: 'check' }, { type: 'line-up', on: true })),
		'Child 5 stands in the middle of the arrival line, but 8 children are shorter and none is taller. Try a shorter child.',
	);
	assert.equal(dsay.feedbackLine(run('class-lineup', { type: 'pick', child: 6 }, { type: 'check' })), 'Child 7 (137 cm) has 5 children shorter and 3 taller. Try a shorter child.');
	assert.equal(dsay.feedbackLine(run('class-lineup', { type: 'pick', child: 1 }, { type: 'check' })), 'Child 2 (122 cm) has 0 children shorter and 8 taller. Try a taller child.');
	// The second wrong Check says that "Show the answer" has appeared; the first doesn't.
	const missOnce = run('class-lineup', { type: 'line-up', on: true }, { type: 'pick', child: 8 }, { type: 'check' });
	assert.equal(dsay.announcementFor(missOnce, { type: 'check' }), dsay.feedbackLine(missOnce));
	const missTwice = dst.reducer(missOnce, { type: 'check' });
	assert.equal(dsay.announcementFor(missTwice, { type: 'check' }), `${dsay.feedbackLine(missTwice)} You can now show the answer.`);
	const found = run('class-lineup', { type: 'pick', child: 0 }, { type: 'check' });
	assert.equal(dsay.feedbackLine(found), 'Yes. Child 1 (133 cm) has 4 children shorter and 4 taller, so the median height is 133 cm.');
	assert.deepEqual(dsay.readoutLines(found), [
		'Mean: (122 + 125 + 128 + 131 + 133 + 137 + 140 + 142 + 148) / 9 = 1,206 / 9 = 134 cm. The tallest children stand further above the median than the shortest stand below it, so the mean sits 1 cm higher.',
		'No height repeats, so this class has no mode.',
		'Range: 148 − 122 = 26 cm.',
	]);
	const given = run('class-lineup', { type: 'pick', child: 4 }, { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
	assert.equal(dsay.feedbackLine(given), 'The middle child is child 1 (133 cm): 4 children are shorter and 4 taller, so the median height is 133 cm.');
	const symbols = dst.reducer(found, { type: 'stage', stage: 'symbols' });
	assert.deepEqual(dsay.symbolLines(symbols).map((line) => line.text), ['x₍₁₎ ≤ x₍₂₎ ≤ … ≤ x₍₉₎', 'median = x₍₅₎ = 133 cm', 'μ = (1/n) Σ xᵢ = 1,206 / 9 = 134 cm']);
	for (const line of dsay.symbolLines(symbols)) assert.ok(!/[₍₎ᵢΣ≤]/.test(line.spoken), `spoken form has symbols: ${line.spoken}`);
	assert.deepEqual(dsay.dataTable(open).headers, ['Child', 'Height (cm)'], 'no Place in line before Check');
	assert.deepEqual(dsay.dataTable(found).headers, ['Child', 'Height (cm)', 'Place in line']);
	assert.deepEqual(dsay.dataTable(found).rows[0], { header: 'Child 1', cells: ['133', '5th'] });
	assert.deepEqual(dsay.summaryTable(open).rows, []);
	assert.equal(dsay.dataTable(open).caption, 'The children, in the order they arrived.');
	assert.equal(dsay.boardLabel(ds.getSetup('class-lineup')), 'A class of children as bars drawn to their height. Find the child in the middle.');

	// Ten children: no child stands at the median, which is halfway between the two middle children.
	const ten = run('class-lineup', { type: 'preset', id: 'ten-children' });
	assert.equal(dsay.statusLine(ten), '10 children, in the order they arrived. Heights from 122 cm to 148 cm.');
	assert.equal(dsay.announcementFor(ten, { type: 'preset', id: 'ten-children' }), 'Ten children. 10 children, in the order they arrived. Heights from 122 cm to 148 cm.');
	assert.equal(
		dsay.feedbackLine(dst.reducer(dst.reducer(ten, { type: 'pick', child: 4 }), { type: 'check' })),
		'Child 5 stands in the middle of the arrival line, but 9 children are shorter and none is taller. Line them up first.',
	);
	assert.equal(
		dsay.feedbackLine(dst.reducer(dst.reducer(ten, { type: 'pick', child: 5 }), { type: 'check' })),
		'Child 6 stands in the middle of the arrival line, but 1 child is shorter and 8 are taller. Line them up first.',
	);
	assert.equal(dsay.feedbackLine(dst.reducer(dst.reducer(ten, { type: 'pick', child: 6 }), { type: 'check' })), 'Child 7 (137 cm) has 6 children shorter and 3 taller. Try a shorter child.');
	const tenFound = dst.reducer(dst.reducer(ten, { type: 'pick', child: 9 }), { type: 'check' });
	assert.equal(
		dsay.feedbackLine(tenFound),
		'Yes. Child 10 (136 cm) is one of the two middle children, with 5 children shorter and 4 taller. The other is child 1 (133 cm), so the median height is halfway between them: (133 + 136) / 2 = 134.5 cm.',
	);
	assert.equal(
		dsay.feedbackLine(dst.reducer(dst.reducer(ten, { type: 'pick', child: 0 }), { type: 'check' })),
		'Yes. Child 1 (133 cm) is one of the two middle children, with 4 children shorter and 5 taller. The other is child 10 (136 cm), so the median height is halfway between them: (133 + 136) / 2 = 134.5 cm.',
	);
	const tenGiven = [{ type: 'pick', child: 4 }, { type: 'check' }, { type: 'check' }, { type: 'show-answer' }].reduce(dst.reducer, ten);
	assert.equal(
		dsay.feedbackLine(tenGiven),
		'The two middle children are child 1 (133 cm) and child 10 (136 cm): 4 children are shorter than both and 4 taller than both, so the median height is halfway between them: (133 + 136) / 2 = 134.5 cm.',
	);
	assert.deepEqual(dsay.readoutLines(tenFound), [
		'Mean: (122 + 125 + 128 + 131 + 133 + 136 + 137 + 140 + 142 + 148) / 10 = 1,342 / 10 = 134.2 cm. The shortest children stand further below the median than the tallest stand above it, so the mean sits 0.3 cm lower.',
		'No height repeats, so this class has no mode.',
		'Range: 148 − 122 = 26 cm.',
	]);
	assert.deepEqual(dsay.summaryTable(tenFound).rows.find((entry) => entry.header === 'Median'), { header: 'Median', cells: ['134.5 cm', 'The average of the 5th and 6th in order'] });
	const tenSymbols = dsay.symbolLines(dst.reducer(tenFound, { type: 'stage', stage: 'symbols' }));
	assert.deepEqual(tenSymbols.map((line) => line.text), ['x₍₁₎ ≤ x₍₂₎ ≤ … ≤ x₍₁₀₎', 'median = (x₍₅₎ + x₍₆₎) / 2 = 134.5 cm', 'μ = (1/n) Σ xᵢ = 1,342 / 10 = 134.2 cm']);
	assert.equal(tenSymbols[1].spoken, 'The median is halfway between x 5 and x 6 in brackets, the 5th and 6th heights in order: 134.5 cm.');
	for (const line of tenSymbols) assert.ok(!/[₍₎ᵢΣ≤]/.test(line.spoken), `spoken form has symbols: ${line.spoken}`);
	assert.deepEqual(dsay.dataTable(tenFound).rows.map((entry) => entry.cells[1]), ['5th', '1st', '8th', '3rd', '10th', '2nd', '7th', '4th', '9th', '6th']);

	// Shared heights: equal heights stand side by side once lined up, and two of them tie for the mode.
	const shared = run('class-lineup', { type: 'preset', id: 'shared-heights' });
	assert.equal(dsay.statusLine(shared), '9 children, in the order they arrived. Heights from 123 cm to 149 cm.');
	assert.equal(dsay.feedbackLine(dst.reducer(dst.reducer(shared, { type: 'pick', child: 1 }), { type: 'check' })), 'Child 2 (127 cm) has 1 child shorter, 6 taller and 1 the same height. Try a taller child.');
	assert.equal(
		dsay.feedbackLine(dst.reducer(dst.reducer(shared, { type: 'pick', child: 4 }), { type: 'check' })),
		'Child 5 stands in the middle of the arrival line, but no child is shorter and 8 are taller. Line them up first.',
	);
	const sharedFound = dst.reducer(dst.reducer(shared, { type: 'pick', child: 6 }), { type: 'check' });
	assert.equal(dsay.feedbackLine(sharedFound), 'Yes. Child 7 (132 cm) has 4 children shorter and 4 taller, so the median height is 132 cm.');
	assert.deepEqual(dsay.readoutLines(sharedFound), [
		'Mean: (123 + 127 + 127 + 130 + 132 + 136 + 141 + 141 + 149) / 9 = 1,206 / 9 = 134 cm. The tallest children stand further above the median than the shortest stand below it, so the mean sits 2 cm higher.',
		'Mode: 127 cm and 141 cm, each held by 2 children.',
		'Range: 149 − 123 = 26 cm.',
	]);
	const modeRowOf = (state) => dsay.summaryTable(state).rows.find((entry) => entry.header === 'Mode');
	assert.deepEqual(modeRowOf(sharedFound), { header: 'Mode', cells: ['127 cm and 141 cm', 'The most common values, tied'] });
	assert.deepEqual(modeRowOf(found), { header: 'Mode', cells: ['None', 'Every value appears equally often'] });
	assert.deepEqual(modeRowOf(dst.initialState('cafe-millionaire')), { header: 'Mode', cells: ['5', 'The most common value'] }, 'no unit on the cafe, as in its readout');
	assert.deepEqual(modeRowOf(run('cafe-millionaire', { type: 'newcomer', on: true }, { type: 'set-value', value: 4 })), { header: 'Mode', cells: ['4 and 5', 'The most common values, tied'] });
	// Equal heights share the first place they take.
	assert.deepEqual(dsay.dataTable(sharedFound).rows.map((entry) => entry.cells[1]), ['7th', '2nd', '6th', '9th', '1st', '4th', '5th', '2nd', '7th']);

	// The cover: before Check, nothing states the median, the mean, the mode, a place or a summary row ("133" may
	// appear, because it is child 1's height in the data table).
	const summaryWords = /median|mean|mode|134|place|5th|summary row|range/i;
	const coveredStates = [
		open,
		run('class-lineup', { type: 'line-up', on: true }),
		...Array.from({ length: 9 }, (_, child) => run('class-lineup', { type: 'pick', child })),
		...Array.from({ length: 9 }, (_, child) => run('class-lineup', { type: 'line-up', on: true }, { type: 'pick', child }, { type: 'check' })),
		run('class-lineup', { type: 'stage', stage: 'numbers' }),
		run('class-lineup', { type: 'check' }),
		// Every preset, loaded fresh or after the last class was solved, with each pick checked, sorted or not.
		...ds.getSetup('class-lineup').presets.flatMap((preset) => {
			const loaded = [dst.initialState('class-lineup'), found].map((from) => dst.reducer(from, { type: 'preset', id: preset.id }));
			const picks = preset.values.flatMap((_, child) => [false, true].map((on) => [{ type: 'line-up', on }, { type: 'pick', child }, { type: 'check' }].reduce(dst.reducer, loaded[0])));
			return [...loaded, ...picks];
		}),
	].filter((state) => dst.isCovered(state));
	assert.ok(coveredStates.length >= 70);
	for (const state of coveredStates) {
		const texts = [
			dsay.statusLine(state),
			...dsay.readoutLines(state),
			...dsay.symbolLines(state).flatMap((line) => [line.text, line.spoken]),
			dsay.dataTable(state).caption,
			...dsay.dataTable(state).headers,
			...dsay.dataTable(state).rows.flatMap((entry) => [entry.header, ...entry.cells]),
			...dsay.summaryTable(state).rows.flatMap((entry) => [entry.header, ...entry.cells]),
			dsay.checkRefusal(state) ?? '',
			dsay.announcementFor(state, { type: 'line-up', on: state.linedUp }),
			dsay.announcementFor(state, { type: 'reset' }),
			dsay.announcementFor(state, { type: 'stage', stage: state.stage }),
			...ds.getSetup('class-lineup').presets.map((preset) => dsay.announcementFor(state, { type: 'preset', id: preset.id })),
		];
		for (const text of texts) assert.ok(!summaryWords.test(text), `covered line-up says: ${text}`);
		// A wrong verdict is allowed "middle" (of the arrival line) but never the median.
		assert.ok(!/median|mean/.test(dsay.feedbackLine(state) ?? ''), dsay.feedbackLine(state));
	}

	// cafe-millionaire.
	const cafe = dst.initialState('cafe-millionaire');
	assert.equal(lines(cafe), '9 customers. Mean: 36 / 9 = 4. Median: 4, the 5th of 9. Mode: 5, held by 3 customers.');
	const rich = run('cafe-millionaire', { type: 'preset', id: 'millionaire' });
	assert.equal(lines(rich), '10 customers. Mean: 1,036 / 10 = 103.6. Median: (4 + 5) / 2 = 4.5, the average of the 5th and 6th. Mode: still 5.');
	assert.equal(dsay.newcomerChange(rich), 'The mean jumped from 4 to 103.6 thousand dollars; the median moved from 4 to 4.5; the mode stayed at 5.');
	assert.equal(dsay.announcementFor(rich, { type: 'newcomer', on: true }), 'The mean jumped from 4 to 103.6 thousand dollars; the median moved from 4 to 4.5; the mode stayed at 5.');
	const neighbor = run('cafe-millionaire', { type: 'preset', id: 'neighbor' });
	assert.equal(lines(neighbor), '10 customers. Mean: 42 / 10 = 4.2. Median: (4 + 5) / 2 = 4.5, the average of the 5th and 6th. Mode: still 5.');
	assert.equal(dsay.newcomerChange(neighbor), 'The mean moved from 4 to 4.2 thousand dollars; the median moved from 4 to 4.5; the mode stayed at 5.');
	assert.equal(dsay.describeSavings(1000), 'newcomer has 1,000 thousand dollars, a million');
	assert.equal(dsay.describeSavings(6), 'newcomer has 6 thousand dollars');
	assert.equal(dsay.formatSavings(1000), '1,000');
	assert.equal(dsay.laneLabel(1000, ds.getSetup('cafe-millionaire')), '1,000 →');

	// class-spread.
	const spread = run('class-spread', { type: 'distances', on: true });
	assert.deepEqual(dsay.readoutLines(spread), [
		'Mean: 1,206 / 9 = 134 cm.',
		'Distances from the mean, 134 cm: −12, −9, −6, −3, −1, +3, +6, +8 and +14 cm. They add up to 0, so their plain average is always 0.',
		'Squared: 144 + 81 + 36 + 9 + 1 + 9 + 36 + 64 + 196 = 576 cm².',
		'Variance: 576 / 9 = 64 cm². Standard deviation: √64 = 8 cm.',
	]);
	// A mean that isn't whole: the "≈" marks already say the distances are rounded.
	assert.equal(
		dsay.readoutLines(dst.reducer(dst.reducer(spread, { type: 'select', child: 4 }), { type: 'set-value', value: 145 }))[1],
		'Distances from the mean, ≈ 133.67 cm: ≈ −11.67, ≈ −8.67, ≈ −5.67, ≈ −2.67, ≈ −0.67, ≈ +3.33, ≈ +6.33, ≈ +8.33 and ≈ +11.33 cm. They add up to 0, so their plain average is always 0.',
	);
	const tight = dst.reducer(spread, { type: 'preset', id: 'tight-class' });
	assert.equal(
		dsay.readoutLines(tight).slice(2).join(' '),
		'Squared: 36 + 16 + 16 + 4 + 0 + 4 + 16 + 16 + 36 = 144 cm². Variance: 144 / 9 = 16 cm². Standard deviation: √16 = 4 cm. Dashed: σ for Our class was 8 cm; now it is 4 cm.',
	);
	// The child-by-child table names the class that is loaded, never "Our class" for another preset's heights.
	assert.equal(dsay.dataTable(spread).caption, 'Heights, child by child: Our class.');
	assert.equal(dsay.dataTable(tight).caption, 'Heights, child by child: Tight class.');
	assert.equal(dsay.dataTable(run('class-spread', { type: 'preset', id: 'everyone-134' })).caption, 'Heights, child by child: Everyone 134 cm.');
	assert.equal(dsay.dataTable(dst.reducer(tight, { type: 'reset' })).caption, 'Heights, child by child: Our class.');
	assert.equal(dsay.dataTable(run('class-spread', { type: 'select', child: 3 }, { type: 'set-value', value: 131 })).caption, 'Heights, child by child.');
	assert.equal(dsay.dataTable(run('class-box', { type: 'preset', id: 'one-very-tall' })).caption, 'Heights, child by child: One very tall child.');
	assert.deepEqual(dsay.readoutLines(run('class-spread', { type: 'preset', id: 'everyone-134' })), [
		'Every child is 134 cm: every distance is 0, so the variance is 0 and σ = 0 cm.',
		'Dashed: σ for Our class was 8 cm; now it is 0 cm.',
	]);
	// Owner decision 6: the sample versions sit beside σ, never instead of it.
	const sample = run('class-spread', { type: 'sample', on: true });
	assert.deepEqual(dsay.readoutLines(sample).slice(-3), [
		'Variance: 576 / 9 = 64 cm². Standard deviation: √64 = 8 cm.',
		'As a sample of a bigger group, the same mean is written x̄ = 134 cm.',
		'Sample variance: 576 / 8 = 72 cm². s = √72 ≈ 8.49 cm.',
	]);
	assert.equal(
		dsay.announcementFor(sample, { type: 'sample', on: true }),
		'As a sample of a bigger group, the same mean is written x̄ = 134 cm. Sample variance: 576 / 8 = 72 cm². s = √72 ≈ 8.49 cm.',
	);
	assert.equal(dsay.announcementFor(dst.reducer(sample, { type: 'sample', on: false }), { type: 'sample', on: false }), 'Sample versions hidden.');
	// With σ = 0 the sample lines still appear, and their switch still speaks.
	const sameSample = run('class-spread', { type: 'preset', id: 'everyone-134' }, { type: 'sample', on: true });
	assert.deepEqual(dsay.sampleLines(sameSample), ['As a sample of a bigger group, the same mean is written x̄ = 134 cm.', 'Sample variance: 0 / 8 = 0 cm². s = √0 = 0 cm.']);
	assert.deepEqual(dsay.readoutLines(sameSample).slice(0, 3), ['Every child is 134 cm: every distance is 0, so the variance is 0 and σ = 0 cm.', ...dsay.sampleLines(sameSample)]);
	assert.equal(dsay.announcementFor(sameSample, { type: 'sample', on: true }), dsay.sampleLines(sameSample).join(' '));
	assert.equal(dsay.readoutLines(run('class-spread', { type: 'sample', on: true }, { type: 'preset', id: 'tight-class' }))[3], 'Sample variance: 144 / 8 = 18 cm². s = √18 ≈ 4.24 cm.');
	assert.equal(
		dsay.symbolLines(run('class-spread', { type: 'stage', stage: 'symbols' })).at(-1).text,
		"÷ 9 counts every child once, as NumPy's np.std does by default. pandas' .std() divides by 8 and gives ≈ 8.49 cm.",
	);
	// "=" before an exact number, "≈" alone before a rounded one: never "= ≈" and never "gives =".
	assert.deepEqual(
		dsay.symbolLines(run('class-spread', { type: 'select', child: 4 }, { type: 'set-value', value: 145 }, { type: 'stage', stage: 'symbols' })).slice(2).map((line) => line.text),
		['σ = √σ² ≈ 7.45 cm', "÷ 9 counts every child once, as NumPy's np.std does by default. pandas' .std() divides by 8 and gives ≈ 7.91 cm."],
	);
	assert.deepEqual(
		dsay.symbolLines(run('class-spread', { type: 'preset', id: 'everyone-134' }, { type: 'stage', stage: 'symbols' })).slice(2).map((line) => line.text),
		['σ = √σ² = 0 cm', "÷ 9 counts every child once, as NumPy's np.std does by default. pandas' .std() divides by 8 and gives 0 cm."],
	);
	assert.equal(dsay.meanLabel(sample), 'μ = x̄ = 134');
	assert.equal(dsay.spreadLabel('s', { exact: false, value: Math.sqrt(72) }), 's ≈ 8.49');
	// The goal: the mean back at exactly 134 and σ under 8, met only after at least two moves.
	assert.equal(dsay.goalLine(spread), 'Goal: without changing the mean, make σ smaller than 8 cm.');
	assert.equal(dsay.goalStatus(spread), 'The mean is 134 cm, but σ = 8 cm is not smaller than 8 cm yet.');
	const oneMove = run('class-spread', { type: 'select', child: 4 }, { type: 'set-value', value: 145 });
	assert.equal(dsay.goalStatus(oneMove), 'The mean is now ≈ 133.67 cm. Move another child to bring it back to 134 cm.');
	const twoMoves = dst.reducer(dst.reducer(oneMove, { type: 'select', child: 1 }), { type: 'set-value', value: 125 });
	assert.equal(dsay.goalMet(twoMoves), true);
	assert.equal(dsay.goalStatus(twoMoves), 'Done: the mean is still 134 cm and σ ≈ 6.98 cm is smaller than 8 cm.');
	assert.equal(dsay.describeHeight(run('class-spread', { type: 'select', child: 3 }), 131), 'child 4, 131 cm');
	assert.equal(
		dsay.announcementFor(oneMove, { type: 'set-value', value: 145 }),
		'Child 5 is now 145 cm. Mean ≈ 133.67 cm, σ ≈ 7.45 cm. The mean is now ≈ 133.67 cm. Move another child to bring it back to 134 cm.',
	);

	// class-box: the three steps.
	assert.equal(lines(dst.initialState('class-box')), '9 children make 8 steps from shortest to tallest.');
	assert.equal(lines(run('class-box', { type: 'stage', stage: 'quartiles' })), 'Each quarter is 2 steps: Q1 is the 3rd in line (128 cm), the median the 5th (133 cm), Q3 the 7th (140 cm).');
	assert.equal(
		lines(run('class-box', { type: 'stage', stage: 'box' })),
		'IQR = 140 − 128 = 12 cm. The fences sit 1.5 × 12 = 18 cm beyond the box, at 110 cm and 158 cm. Every child is inside them, so the whiskers reach the shortest (122 cm) and the tallest (148 cm).',
	);
	assert.equal(
		dsay.readoutLines(run('class-box', { type: 'stage', stage: 'box' }, { type: 'preset', id: 'one-very-tall' }))[1],
		'162 cm is above the upper fence (158 cm), so it is drawn as its own dot and the whisker stops at 142 cm.',
	);

	// marks-scaling.
	assert.equal(lines(dst.initialState('marks-scaling')), 'Ana scored 36 out of 50 on test A (72%) and 58 out of 80 on test B (72.5%).');
	assert.equal(
		lines(run('marks-scaling', { type: 'scale', scale: 'minmax' })),
		'Test A: (36 − 21) / (39 − 21) = 15/18 = 5/6 ≈ 0.83. Test B: (58 − 38) / (64 − 38) = 20/26 = 10/13 ≈ 0.77. Min–max says test A.',
	);
	assert.equal(lines(run('marks-scaling', { type: 'scale', scale: 'z' })), 'Test A: (36 − 30) / 6 = 1. Test B: (58 − 50) / 8 = 1. Ana is exactly one standard deviation above the mean on both.');
	const low = run('marks-scaling', { type: 'preset', id: 'low-mark' });
	assert.equal(
		dsay.announcementFor(low, { type: 'preset', id: 'low-mark' }),
		"One mark of 10 moved both scores for test B: min–max rose from ≈ 0.77 to 48/54 = 8/9 ≈ 0.89, the z-score fell from 1 to ≈ 0.76. Ana's 58 did not change.",
	);
	assert.equal(lines(dst.reducer(low, { type: 'scale', scale: 'z' })), 'Test A: (36 − 30) / 6 = 1. Test B: mean ≈ 46.89, σ ≈ 14.70, so z = (58 − 46.89) / 14.70 ≈ 0.76. z says test A.');

	// pumpkin-outliers.
	assert.equal(
		lines(run('pumpkin-outliers', { type: 'preset', id: 'one-giant' })),
		'Q1 = 5 kg, Q3 = 7 kg, IQR = 2 kg, so the upper fence is 7 + 3 = 10 kg. The 30 kg pumpkin is past it: the IQR rule flags it. Mean ≈ 8.44 kg, σ ≈ 7.68 kg, so its z-score is ≈ 2.81: flagged at |z| > 2, not at |z| > 3.',
	);
	assert.equal(
		dsay.readoutLines(run('pumpkin-outliers', { type: 'preset', id: 'one-giant' }, { type: 'cutoff', cutoff: 3 })).at(-1),
		'With 9 pumpkins no z-score can reach √8 ≈ 2.83, however heavy the giant, so |z| > 3 can never flag anything here.',
	);
	assert.equal(
		dsay.readoutLines(run('pumpkin-outliers', { type: 'preset', id: 'two-giants' }))[1],
		'Mean 11 kg, σ ≈ 10.19 kg, each z ≈ 1.87. Neither passes |z| > 2: the two giants hide each other. The IQR rule still flags both.',
	);
	assert.equal(dsay.readoutLines(dst.initialState('pumpkin-outliers'))[1], 'Every pumpkin is inside the fences (2 kg to 10 kg) and every |z| is at most ≈ 1.73: nothing is flagged.');
	assert.equal(dsay.readoutLines(run('pumpkin-outliers', { type: 'set-value', value: 10 }))[1], "On the fence is not past it: the IQR rule doesn't flag 10 kg, but z ≈ 2.34 passes |z| > 2.");
	assert.equal(dsay.describeGiant(run('pumpkin-outliers', { type: 'preset', id: 'two-giants' }), 30), 'both giant pumpkins, 30 kg');
	assert.equal(dsay.describeGiant(dst.initialState('pumpkin-outliers'), 30), 'giant pumpkin, 30 kg');
	assert.equal(dsay.laneLabel(45, ds.getSetup('pumpkin-outliers')), '45 kg →');

	// Board labels match the notation registry's symbols for μ, σ and z (decision 0009).
	const { NOTATION } = await import('../src/data/notation.mjs');
	const notationSay = Object.fromEntries(NOTATION.map((entry) => [entry.key, entry.say]));
	assert.equal(notationSay.mu, '"mu"');
	assert.equal(notationSay.sigma, '"sigma"');
	assert.ok(dsay.symbolLines(run('class-spread', { type: 'stage', stage: 'symbols' }))[0].spoken.startsWith('mu,'));
	assert.ok(dsay.symbolLines(run('class-spread', { type: 'stage', stage: 'symbols' }))[2].spoken.startsWith('sigma,'));

	// Every reachable sentence: American spelling, no em dash, and never the banned word.
	const banned = new RegExp(['pro', 'mpt'].join(''), 'i');
	const british = /standardis|normalis|summaris|colour|centre|grey|metre\b/i;
	let swept = 0;
	for (const id of ds.SETUP_IDS) {
		const setup = ds.getSetup(id);
		const actions = [
			{ type: 'line-up', on: true }, { type: 'pick', child: 0 }, { type: 'pick', child: 4 }, { type: 'check' }, { type: 'show-answer' },
			{ type: 'select', child: 2 }, { type: 'distances', on: true }, { type: 'sample', on: true }, { type: 'newcomer', on: true }, { type: 'newcomer', on: false },
			...['raw', 'minmax', 'z'].map((scale) => ({ type: 'scale', scale })), { type: 'cutoff', cutoff: 3 }, { type: 'cutoff', cutoff: 2 },
			...setup.stages.map((stage) => ({ type: 'stage', stage })), ...setup.presets.map((preset) => ({ type: 'preset', id: preset.id })), { type: 'reset' },
			// Line-up presets: each class's wrong, shown and right verdicts and its stages after Check.
			...(setup.kind === 'lineup'
				? setup.presets.flatMap((preset) => {
						const load = [{ type: 'reset' }, { type: 'preset', id: preset.id }];
						const after = setup.stages.map((stage) => ({ type: 'stage', stage }));
						const shown = [{ type: 'pick', child: 4 }, { type: 'check' }, { type: 'check' }, { type: 'show-answer' }];
						const everyPick = preset.values.flatMap((_, child) => [{ type: 'pick', child }, { type: 'check' }]);
						return [...load, ...shown, ...after, ...load, ...everyPick, ...after];
					})
				: []),
			...(setup.slider ? [setup.slider.min, setup.slider.max].map((value) => ({ type: 'set-value', value })) : []),
		];
		let state = dst.initialState(id);
		for (const action of [...actions, ...actions]) {
			state = dst.reducer(state, action);
			const texts = [
				dsay.statusLine(state), dsay.feedbackLine(state) ?? '', dsay.goalLine(state) ?? '', dsay.goalStatus(state) ?? '', ...dsay.readoutLines(state),
				...dsay.symbolLines(state).flatMap((line) => [line.text, line.spoken]), dsay.announcementFor(state, action), dsay.boardLabel(setup),
				...[dsay.dataTable(state), dsay.summaryTable(state)].flatMap((table) => [table.caption, ...table.headers, ...table.rows.flatMap((entry) => [entry.header, ...entry.cells])]),
				...Object.values(dsay.CONTROL_LABELS), ...Object.values(dsay.STAGE_LABELS), ...Object.values(dsay.SCALE_LABELS), dsay.axisUnit(state),
			];
			for (const text of texts) {
				assert.equal(typeof text, 'string');
				assert.ok(!banned.test(text) && !british.test(text) && !text.includes('—'), `${id} after ${action.type}: ${text}`);
				assert.ok(!/undefined|NaN|null/.test(text), `${id} after ${action.type}: ${text}`);
				assert.ok(!/= ≈|gives =/.test(text), `${id} after ${action.type}: ${text}`);
				swept += 1;
			}
		}
	}
	assert.ok(swept > 2000, `swept ${swept} strings`);
}

// ---- DescriptiveStats chart (chart.ts) ----
// What the drawing shows: no mean or median before the middle child is found, no blue on the line-up page, values
// past the axis in the lane, and the box plot's whisker stopping at the last child inside the fences.
{
	const dc = await import('../src/components/react/descriptiveStats/chart.ts');
	const dst = await import('../src/components/react/descriptiveStats/state.ts');
	const { readFileSync, readdirSync } = await import('node:fs');
	const run = (setupId, ...actions) => actions.reduce(dst.reducer, dst.initialState(setupId));
	const numbersStage = { type: 'stage', stage: 'numbers' };

	const covered = dc.chartRows(run('class-lineup', numbersStage, { type: 'pick', child: 6 }))[0];
	assert.equal(covered.mean, null);
	assert.equal(covered.median, null);
	assert.deepEqual(covered.spans, []);
	assert.deepEqual(covered.dots.map((dot) => dot.look), [false, false, false, false, false, false, true, false, false], 'the pick is the one ochre dot');
	assert.ok(covered.dots.every((dot) => dot.text === null), 'no place numbers before Check');
	const found = dc.chartRows(run('class-lineup', numbersStage, { type: 'pick', child: 0 }, { type: 'check' }))[0];
	assert.equal(found.mean.label, 'mean 134');
	assert.equal(found.median.label, 'median 133');
	assert.deepEqual(found.spans, [], 'no blue on the line-up page');
	assert.equal(found.reserve, 2, 'room for the shared-heights preset, whose equal heights stack two high');
	assert.deepEqual(dc.lineUpBars(run('class-lineup', { type: 'line-up', on: true })).map((bar) => bar.slot), [4, 0, 6, 2, 8, 1, 5, 3, 7]);

	const rich = dc.chartRows(run('cafe-millionaire', { type: 'preset', id: 'millionaire' }))[0];
	assert.equal(rich.mean.lane, true);
	assert.equal(rich.mean.label, 'mean 103.6 →');
	assert.deepEqual(rich.dots.filter((dot) => dot.lane).map((dot) => dot.text), ['1,000 →']);
	assert.deepEqual(rich.modeTags, [{ x: 50, row: 3 }]);

	const sample = dc.chartRows(run('class-spread', { type: 'sample', on: true }, { type: 'preset', id: 'tight-class' }))[0];
	assert.deepEqual(sample.spans.map((span) => [span.kind, span.label]), [['sigma', 'σ = 4'], ['sample', 's ≈ 4.24'], ['ghost', 'Before: σ = 8']]);
	assert.equal(sample.mean.label, 'μ = x̄ = 134');

	const tall = dc.chartRows(run('class-box', { type: 'stage', stage: 'box' }, { type: 'preset', id: 'one-very-tall' }))[0];
	assert.equal(tall.box.high, ((142 - 110) / 60) * 100, 'the whisker stops at 142 cm');
	assert.deepEqual(tall.box.fences, [0, 80]);
	assert.equal(tall.dots[4].iqrFlag, true);
	assert.deepEqual(dc.chartRows(dst.initialState('class-box'))[0].dots.map((dot) => dot.text), ['5', '1', '7', '3', '9', '2', '6', '4', '8']);

	const giants = dc.chartRows(run('pumpkin-outliers', { type: 'preset', id: 'two-giants' }, { type: 'set-value', value: 45 }))[0];
	assert.deepEqual(giants.dots.filter((dot) => dot.lane).map((dot) => [dot.text, dot.iqrFlag, dot.zFlag]), [['45 kg →', true, false], ['45 kg →', true, false]]);
	const zRows = dc.chartRows(run('marks-scaling', { type: 'scale', scale: 'z' }));
	assert.deepEqual(zRows.map((row) => row.zTicks.map((tick) => tick.kind)), [['mean', 'sigma', 'sigma'], ['mean', 'sigma', 'sigma']]);
	assert.deepEqual(dc.chartRows(dst.initialState('marks-scaling')).map((row) => row.zTicks.length), [0, 0], 'pink and blue only on the z scale');

	// The board's files never render KaTeX (decision 0007).
	const files = ['src/components/react/DescriptiveStats.tsx', ...readdirSync('src/components/react/descriptiveStats').map((name) => `src/components/react/descriptiveStats/${name}`)];
	for (const file of files) assert.ok(!readFileSync(file, 'utf8').includes('<LaTeX'), `${file} renders KaTeX`);
}

// ---- VectorBoard2D (decision 0014) ----
// Whole-number vectors make every sum, scaling, dot product and exact angle an integer fact. These asserts pin the
// copy word for word and the rule that nothing gives an answer away before the reader commits.
{
	const vm = await import('../src/components/react/vectorBoard/model.ts');
	const vs = await import('../src/components/react/vectorBoard/setups.ts');
	const vst = await import('../src/components/react/vectorBoard/state.ts');
	const vd = await import('../src/components/react/vectorBoard/describe.ts');
	const { readFileSync, readdirSync } = await import('node:fs');
	const runVec = (setupId, ...actions) => actions.reduce(vst.reducer, vst.initialState(setupId));
	const step = (id, axis, direction) => ({ type: 'step', id, axis, direction });
	const steps = (id, axis, direction, count) => Array.from({ length: count }, () => step(id, axis, direction));
	const moveTo = (id, to) => ({ type: 'move', id, to });
	/** Every sentence a state can show or say (except announcements, which take an action). */
	const allText = (state) => [
		vd.boardLabel(state),
		vd.statusLine(state),
		...vd.readoutLines(state),
		vd.feedbackLine(state) ?? '',
		...vd.tableRows(state).flatMap((row) => [row.name, row.x, row.y, row.length, row.spoken]),
		...vd.lengthLines(state),
		...vd.handlesFor(state).map((handle) => handle.label),
		...vd.planeLabels(state).map((label) => label.text),
		...vd.refusalNotes(state).map((note) => note.text),
		vd.listsLine(state) ?? '',
		...vd.columnVectors(state).map((column) => column.spoken),
		vd.chalkNote(state)?.long ?? '',
		vd.chalkNote(state)?.short ?? '',
	];
	/** Text that doesn't come from the reader's own guess, so it must never hold the answer before Check. */
	const answerFreeText = (state) => [
		vd.boardLabel(state),
		vd.statusLine(state),
		...vd.readoutLines(state),
		...vd.tableRows(state).filter((row) => row.id !== 'guess').flatMap((row) => [row.name, row.x, row.y, row.length, row.spoken]),
		...vd.lengthLines(state),
		...vd.handlesFor(state).map((handle) => handle.label),
		...vd.planeLabels(state).filter((label) => label.id !== 'guess').map((label) => label.text),
		...vd.refusalNotes(state).map((note) => note.text),
		vd.listsLine(state) ?? '',
		...vd.columnVectors(state).map((column) => column.spoken),
		vd.chalkNote(state)?.long ?? '',
	];
	const assertNone = (texts, forbidden, where) => {
		for (const text of texts) {
			for (const word of forbidden) assert.ok(!text.includes(word), `${where}: "${text}" gives away "${word}"`);
		}
	};

	// Vector arithmetic on whole numbers.
	assert.deepEqual(vm.add([3, 2], [1, 3]), [4, 5]);
	assert.deepEqual(vm.subtract([3, 2], [1, 3]), [2, -1]);
	assert.deepEqual(vm.scale(-1, [2, 1]), [-2, -1]);
	assert.equal(vm.dot([4, 1], [-1, 3]), -1);
	assert.equal(vm.cross([4, 1], [-1, 3]), 13);
	assert.equal(vm.lengthSquared([3, 2]), 13);
	assert.ok(vm.isZero([0, 0]));
	assert.ok(vm.equals([1, 2], [1, 2]) && !vm.equals([1, 2], [2, 1]));
	// Snapping never yields −0, which would print as "−0".
	assert.ok(Object.is(vm.snapToGrid([-0.2, 2.6])[0], 0));
	assert.deepEqual(vm.snapToGrid([-0.2, 2.6]), [0, 3]);
	// Every constraint is round-then-clamp per component: a box, never a hole.
	const fiveBox = vm.symmetricBox(5);
	assert.deepEqual(vm.snapInto([7.4, -9], fiveBox), [5, -5]);
	assert.deepEqual(vm.intersectBoxes(fiveBox, vm.shiftBox(fiveBox, [-1, -3])), { min: [-5, -5], max: [4, 2] });

	// Exact angles come from integer tests; others from atan2, in degrees.
	assert.deepEqual(vm.angleOf([3, 1], [-1, 3]), { exact: 90 });
	assert.deepEqual(vm.angleOf([2, 1], [-4, -2]), { exact: 180 });
	assert.deepEqual(vm.angleOf([2, 1], [4, 2]), { exact: 0 });
	assert.deepEqual(vm.angleOf([3, 1], [1, 2]), { exact: 45 });
	assert.deepEqual(vm.angleOf([3, 1], [2, 4]), { exact: 45 });
	assert.deepEqual(vm.angleOf([1, 0], [-1, 1]), { exact: 135 });
	assert.ok(Math.abs(vm.angleOf([4, 1], [-1, 3]).approx - 94.4) < 0.05);
	assert.equal(vm.angleOf([0, 0], [1, 2]), null);
	assert.equal(vm.angleOf([1, 2], [0, 0]), null);
	assert.equal(vm.shadowLength([1, 0], [3, 4]), 3);
	assert.equal(vm.shadowLength([0, 0], [3, 4]), null);
	assert.deepEqual(vm.shadowTip([2, 1], [5, 5]), [6, 3]);

	// Lengths: exact when the square is a perfect square, otherwise "√n ≈ value". Square roots aren't simplified.
	assert.equal(vm.rootText(25), '5');
	assert.equal(vm.rootText(13), '√13 ≈ 3.61');
	assert.equal(vm.rootText(0), '0');
	assert.equal(vm.rootText(20), '√20 ≈ 4.47');
	assert.throws(() => vm.rootText(1.25), /whole number/);
	assert.equal(vm.lengthText([3, 4]), '5');
	assert.equal(vm.lengthText([1, 0.5]), '≈ 1.12');
	assert.equal(vm.numberText(-1.5), '−1.5');
	assert.equal(vm.numberText(4), '4');
	assert.equal(vm.numberText(0.5), '0.5');

	// The trip guess names the specific mistake, checked in order.
	const tripA = [3, 2];
	const tripB = [1, 3];
	const tripCases = [
		[[4, 5], 'match'],
		[[5, 4], 'swapped'],
		[[3, 2], 'first-trip'],
		[[1, 3], 'second-trip'],
		[[2, -1], 'difference'],
		[[-2, 1], 'difference'],
		[[3, 6], 'product'],
		[[0, 0], 'start'],
		[[1, 1], 'other'],
	];
	for (const [guess, kind] of tripCases) assert.equal(vm.classifyTripGuess(tripA, tripB, guess), kind, `guess ${guess}`);

	// The cart push: right length first, then the part along the track.
	const cartCases = [
		[[3, 4], 'match'],
		[[3, -4], 'match'],
		[[4, 4], 'wrong-length'],
		[[4, 3], 'too-much'],
		[[5, 0], 'too-much'],
		[[0, 5], 'too-little'],
		[[-3, 4], 'backward'],
	];
	for (const [push, kind] of cartCases) assert.equal(vm.classifyCartPush(push, [1, 0], 25, 3), kind, `push ${push}`);
	assert.equal(vm.classifyScale(-1, -1), 'match');
	assert.equal(vm.classifyScale(1, -1), 'unchanged');
	assert.equal(vm.classifyScale(0, -1), 'zero');
	assert.equal(vm.classifyScale(2, -1), 'same-direction');
	assert.equal(vm.classifyScale(0.5, -1), 'same-direction');
	assert.equal(vm.classifyScale(-2, -1), 'flipped-longer');
	assert.equal(vm.classifyScale(-0.5, -1), 'flipped-shorter');

	// Labels sit off the arrow's middle, written by hand (never vec.lerp, which gives NaN for a zero arrow).
	const anchor = vm.labelAnchor([0, 0], [4, 0], 1);
	assert.ok(Math.abs(anchor[0] - 2) < 1e-12 && anchor[1] > 0);
	assert.ok(vm.labelAnchor([1, 1], [1, 1], 1).every(Number.isFinite));
	assert.ok(vm.labelAnchor([0, 0], [4, 0], -1)[1] < 0);

	// Setups: a typo fails loudly, and validateSetup refuses what the board can't draw or answer.
	assert.throws(() => vs.getSetup('trips-ad'), /unknown setup "trips-ad"/);
	assert.deepEqual(Object.keys(vs.SETUPS), ['trips-add', 'trips-scale', 'cart-push', 'align']);
	const broken = (id, change) => ({ ...vs.getSetup(id), ...change });
	assert.throws(() => vs.validateSetup(broken('trips-add', { presets: [...vs.getSetup('trips-add').presets, { id: 'x', label: 'X', a: [1, 1], b: [1, 1] }] })), /presets; the most is 4/);
	assert.throws(() => vs.validateSetup(broken('trips-add', { presets: [{ id: 'far', label: 'Far', a: [4, 4], b: [3, 0] }, { id: 'ok', label: 'Ok', a: [1, 1], b: [1, 1] }] })), /a \+ b = \(7, 4\) leaves the board/);
	assert.throws(() => vs.validateSetup(broken('trips-add', { opening: { ...vs.getSetup('trips-add').opening, a: [6, 0] } })), /opening a = \(6, 0\) is outside/);
	assert.throws(() => vs.validateSetup(broken('trips-add', { opening: { ...vs.getSetup('trips-add').opening, a: [1.5, 0] } })), /whole numbers/);
	assert.throws(() => vs.validateSetup(broken('trips-scale', { limitA: 3 })), /c a can reach 6/);
	assert.throws(() => vs.validateSetup(broken('cart-push', { opening: { ...vs.getSetup('cart-push').opening, b: [0, 0] } })), /track is the zero vector/);
	assert.throws(() => vs.validateSetup(broken('cart-push', { goal: { targetLengthSquared: 25, targetForward: 2 } })), /no whole-number push/);
	assert.throws(() => vs.validateSetup(broken('cart-push', { presets: [...vs.getSetup('cart-push').presets.slice(0, 3), { id: 'odd', label: 'Odd', a: [1, 0], b: [1, 1] }] })), /track length must be a whole number/);
	assert.throws(() => vs.validateSetup(broken('align', { opening: { ...vs.getSetup('align').opening, b: [0, 0] } })), /opening has a zero vector/);
	assert.throws(() => vs.validateSetup(broken('align', { limitB: 5 })), /shadow of b can reach/);
	// The worst shadow the critique found: a = (2, 1), b = (5, 5) puts the tip at (6, 3), off the board. With b's
	// entries kept within ±4, no a and b on align can do that.
	assert.ok(!vm.withinView(vm.shadowTip([2, 1], [5, 5])));
	assert.equal(vs.getSetup('align').limitB, 4);
	let worstShadow = 0;
	for (let ax = -5; ax <= 5; ax++) for (let ay = -5; ay <= 5; ay++) for (let bx = -4; bx <= 4; bx++) for (let by = -4; by <= 4; by++) {
		const tip = vm.shadowTip([ax, ay], [bx, by]);
		if (tip) worstShadow = Math.max(worstShadow, Math.abs(tip[0]), Math.abs(tip[1]));
	}
	assert.ok(worstShadow <= 5, `align's worst shadow reaches ${worstShadow}`);

	// ---- trips-add ----
	const tripsOpen = vst.initialState('trips-add');
	assert.equal(tripsOpen.stage, 'trips');
	assert.equal(
		vd.statusLine(tripsOpen),
		'Trip a: 3 steps east, 2 steps north. Trip b: 1 step east, 3 steps north. Where do you end up? Move the ochre ring there, then press Check.',
	);
	assert.deepEqual(vd.handlesFor(tripsOpen).map((handle) => [handle.id, handle.label]), [['guess', 'Your guess for where the two trips end. Its position is in the table below']]);
	assert.equal(vd.ochreElement(tripsOpen), 'guess');
	assert.deepEqual(vd.presetsFor(tripsOpen), []);
	assert.equal(vd.boardLabel(tripsOpen), 'Two trips on a grid. Move the ochre ring to where they end, then press Check; or use the steppers in the table.');
	// a and b are the question: their steppers are refused, and presses say why.
	assert.equal(vst.stepRefusal(tripsOpen, 'a', 'x', 1)?.kind, 'locked');
	const lockedPress = vst.reducer(tripsOpen, step('a', 'x', 1));
	assert.deepEqual(lockedPress.a, [3, 2]);
	assert.equal(vd.announcementFor(lockedPress, step('a', 'x', 1)), 'a and b are the question. Press Check first.');
	assert.deepEqual(vd.refusalNotes(tripsOpen).map((note) => note.text), ['a and b are the question. Press Check first.']);
	assert.equal(vst.reducer(tripsOpen, moveTo('a', [2, 2])), tripsOpen);
	assert.equal(vst.reducer(tripsOpen, { type: 'preset', id: 'there-and-back' }), tripsOpen);
	// Lists waits for Check; Trips and Arrows don't.
	assert.ok(vst.stageAllowed(tripsOpen, 'arrows') && !vst.stageAllowed(tripsOpen, 'lists'));
	assert.equal(vst.reducer(tripsOpen, { type: 'stage', stage: 'lists' }), tripsOpen);

	// Nothing names the sum before Check, in any stage, wherever the guess sits; the guess's own row and label echo it.
	for (const stage of ['trips', 'arrows']) {
		for (const guess of [[0, 0], [4, 5], [5, 4], [-5, 5]]) {
			const state = runVec('trips-add', { type: 'stage', stage }, moveTo('guess', guess));
			assertNone(answerFreeText(state), ['a + b', '(4, 5)', '4 steps east, 5 steps north', '√41', 'Both trips'], `trips-add ${stage} guess ${guess}`);
		}
	}
	const guessAt = (guess, stage = 'trips') => runVec('trips-add', { type: 'stage', stage }, moveTo('guess', guess));
	assert.equal(vd.announcementFor(guessAt([5, 4]), moveTo('guess', [5, 4])), 'Your guess: 5 steps east, 4 steps north. Your guess is at the right edge of the board.');
	assert.equal(vd.announcementFor(guessAt([4, 5]), moveTo('guess', [4, 5])), 'Your guess: 4 steps east, 5 steps north. Your guess is at the top edge of the board.');
	assert.equal(vd.announcementFor(guessAt([1, -2]), moveTo('guess', [1, -2])), 'Your guess: 1 step east, 2 steps south.');
	assert.equal(vd.announcementFor(guessAt([4, 5], 'arrows'), moveTo('guess', [4, 5])), 'Your guess: (4, 5). Your guess is at the top edge of the board.');
	assert.deepEqual(vd.tableRows(guessAt([4, 5])).find((row) => row.id === 'guess')?.spoken, 'Your guess: 4 steps east, 5 steps north.');
	// The guess's steppers move it one step at a time; at the edge they refuse with a visible reason.
	const guessEast = runVec('trips-add', ...steps('guess', 'x', 1, 7));
	assert.deepEqual(guessEast.guess, [5, 0]);
	assert.equal(guessEast.refusal?.kind, 'edge');
	assert.equal(vd.announcementFor(guessEast, step('guess', 'x', 1)), "Your guess can't go further east: the board ends at 5.");
	assert.equal(vd.stepperName(guessEast, 'guess', 'x', 1), 'Move your guess 1 east');
	assert.equal(vd.stepperName(guessEast, 'a', 'y', -1), 'Move a 1 south');
	assert.equal(vd.stepperGroupName(guessEast, 'a', 'x'), 'Move a east or west');
	assert.equal(vd.stepperGroupName(guessEast, 'guess', 'y'), 'Move your guess north or south');

	// Check verdicts, word for word.
	const checkTrip = (guess) => runVec('trips-add', moveTo('guess', guess), { type: 'check' });
	assert.equal(vd.feedbackLine(checkTrip([4, 5])), 'Yes. East: 3 + 1 = 4. North: 2 + 3 = 5. Both trips end where one trip of 4 east and 5 north would.');
	assert.equal(vd.feedbackLine(checkTrip([5, 4])), 'Not quite. Your guess swaps east and north. Add the east steps of both trips first.');
	assert.equal(vd.feedbackLine(checkTrip([3, 2])), "Not quite. That's where trip a ends. Trip b starts there, so keep walking.");
	assert.equal(vd.feedbackLine(checkTrip([1, 3])), "Not quite. That's where trip b ends on its own. Walk trip a first, then trip b from where a stops.");
	assert.equal(vd.feedbackLine(checkTrip([2, -1])), "Not quite. The second trip adds its steps; it doesn't take them away.");
	// The product guess (3, 6) lies off the board, so the reader can't reach it on the opening; its copy is pinned on a
	// built verdict, as EventSpace pins a plural no setup reaches.
	assert.equal(vd.feedbackLine({ ...tripsOpen, feedback: { kind: 'trip', result: 'product' } }), "Not quite. Steps add up; they don't multiply.");
	assert.deepEqual(checkTrip([3, 6]).guess, [3, 5]);
	assert.equal(vd.feedbackLine(checkTrip([0, 0])), 'Not quite. Your guess is still at the start. Move it to where you think the two trips end.');
	assert.equal(vd.feedbackLine(checkTrip([1, 1])), 'Not quite. Add the east steps of both trips, then the north steps.');
	// A second miss offers the answer; the shown answer is never praised.
	const twoMisses = runVec('trips-add', { type: 'check' }, { type: 'check' });
	assert.equal(vd.feedbackLine(twoMisses), 'Not quite. Your guess is still at the start. Move it to where you think the two trips end. You can now show the answer.');
	assert.equal(vst.reducer(runVec('trips-add', { type: 'check' }), { type: 'show-answer' }).checked, false);
	const shownTrip = vst.reducer(twoMisses, { type: 'show-answer' });
	assert.ok(shownTrip.checked);
	assert.ok(vd.feedbackLine(shownTrip).startsWith('Here it is.'));
	assert.ok(!vd.feedbackLine(shownTrip).includes('Yes'));
	// Moving the guess clears a stale verdict.
	assert.equal(vd.feedbackLine(vst.reducer(checkTrip([5, 4]), moveTo('guess', [4, 4]))), null);

	// After Check: the guess goes, the sum is the ochre element, a and b's tips move.
	const tripsDone = checkTrip([4, 5]);
	assert.equal(vd.ochreElement(tripsDone), 'sum');
	assert.deepEqual(vd.handlesFor(tripsDone).map((handle) => [handle.id, handle.label, handle.point]), [
		['a', 'Tip of trip a. Its position is in the table below', [3, 2]],
		['sum', 'End of trip b, where both trips end. Its position is in the table below', [4, 5]],
	]);
	assert.deepEqual(vd.readoutLines(tripsDone), [
		'Trip a: 3 steps east, 2 steps north.',
		'Trip b: 1 step east, 3 steps north.',
		'Both trips: 4 steps east, 5 steps north, the same as one straight trip.',
	]);
	assert.deepEqual(vd.chalkNote(tripsDone), { long: "the trips add, the lengths don't", short: "trips add, lengths don't" });
	assert.equal(vd.chalkNote(tripsOpen), null);
	const tripsArrows = vst.reducer(tripsDone, { type: 'stage', stage: 'arrows' });
	assert.deepEqual(vd.readoutLines(tripsArrows), ['a = (3, 2), b = (1, 3), a + b = (4, 5).', 'Length of a + b: √41 ≈ 6.40. The two trips\' lengths add to √13 + √10 ≈ 6.77.']);
	const tripsLists = vst.reducer(tripsDone, { type: 'stage', stage: 'lists' });
	assert.equal(tripsLists.stage, 'lists');
	assert.equal(vd.listsLine(tripsLists), 'a + b = (3 + 1, 2 + 3) = (4, 5)');
	assert.deepEqual(vd.columnVectors(tripsLists).map((column) => column.spoken), ['a is the column 3, 2', 'b is the column 1, 3', 'a + b is the column 4, 5']);
	// Dragging a keeps b: the sum handle follows. Dragging the sum changes b.
	const aMoved = vst.reducer(tripsArrows, moveTo('a', [2, 2]));
	assert.deepEqual([aMoved.a, aMoved.b], [[2, 2], [1, 3]]);
	assert.equal(vd.announcementFor(aMoved, moveTo('a', [2, 2])), 'a = (2, 2). a + b = (3, 5). a + b is at the top edge of the board.');
	const sumMoved = vst.reducer(tripsArrows, moveTo('sum', [5, 5]));
	assert.deepEqual([sumMoved.a, sumMoved.b], [[3, 2], [2, 3]]);
	assert.equal(vd.announcementFor(sumMoved, moveTo('sum', [5, 5])), 'b = (2, 3). a + b = (5, 5). a + b is at the top-right corner of the board.');
	// A corner is one sentence, named for what reaches it: moving a can put a + b in the corner.
	assert.equal(vd.handleAnnouncement(vst.reducer(sumMoved, moveTo('a', [3, 2])), 'a'), 'a = (3, 2). a + b = (5, 5). a + b is at the top-right corner of the board.');
	assert.equal(vd.announcementFor(guessAt([-5, -5]), moveTo('guess', [-5, -5])), 'Your guess: 5 steps west, 5 steps south. Your guess is at the bottom-left corner of the board.');
	// a moves only where a + b stays on the board, and b (drawn from the origin in "b first") stays on it too.
	assert.deepEqual(vst.handleBox(tripsArrows, 'a'), { min: [-5, -5], max: [4, 2] });
	assert.deepEqual(vst.reducer(tripsArrows, moveTo('a', [5, 5])).a, [4, 2]);
	const farLeft = runVec('trips-add', moveTo('guess', [4, 5]), { type: 'check' }, moveTo('a', [-5, 0]));
	assert.deepEqual(vst.handleBox(farLeft, 'sum'), { min: [-5, -5], max: [0, 5] });
	assert.deepEqual(vst.reducer(farLeft, moveTo('sum', [5, 0])).b, [5, 0]);
	const aEdge = runVec('trips-add', moveTo('guess', [4, 5]), { type: 'check' }, { type: 'stage', stage: 'arrows' }, moveTo('a', [4, 2]));
	assert.equal(vst.stepRefusal(aEdge, 'a', 'x', 1)?.kind, 'sum-edge');
	assert.equal(vd.refusalText(aEdge, vst.stepRefusal(aEdge, 'a', 'x', 1)), "a can't go further east: a + b would leave the board.");
	const aWall = runVec('trips-add', moveTo('guess', [4, 5]), { type: 'check' }, { type: 'preset', id: 'there-and-back' }, ...steps('a', 'x', 1, 2));
	assert.deepEqual(aWall.a, [5, 2]);
	assert.equal(vd.refusalText(aWall, vst.stepRefusal(aWall, 'a', 'x', 1)), "a can't go further east: the board ends at 5.");
	assert.equal(vd.handleAnnouncement(aWall, 'a'), 'Trip a: 5 steps east, 2 steps north. Both trips: 2 steps east, 0 steps north. a is at the right edge of the board.');
	// "Show b first too" draws the other route; it exists only after Check.
	assert.equal(vst.reducer(tripsOpen, { type: 'other-order', on: true }).otherOrder, false);
	assert.ok(vst.reducer(tripsDone, { type: 'other-order', on: true }).otherOrder);
	assert.equal(vd.announcementFor(vst.reducer(tripsDone, { type: 'other-order', on: true }), { type: 'other-order', on: true }), 'Showing b first too: walking b, then a, ends at the same spot.');

	// Presets, after Check.
	assert.deepEqual(vd.presetsFor(tripsDone).map((preset) => preset.label), ['Two trips', 'There and back', 'Same direction', 'Square corner']);
	// The opening is the "Two trips" preset; moving the guess doesn't leave it, moving a does.
	assert.equal(tripsDone.activePreset, 'two-trips');
	assert.equal(vst.reducer(tripsArrows, moveTo('a', [2, 2])).activePreset, null);
	const tripPreset = (id) => vst.reducer(tripsArrows, { type: 'preset', id });
	assert.deepEqual(vd.readoutLines(tripPreset('there-and-back')), ['a = (3, 2), b = (−3, −2), a + b = (0, 0).', 'Both trips: you end where you started. a + b = (0, 0), the zero vector.']);
	// The chalk note agrees with the length readout: same direction, the lengths add; a zero sum gets no note.
	assert.deepEqual(vd.chalkNote(tripPreset('same-direction')), { long: 'same direction: the lengths add too', short: 'same way: lengths add' });
	assert.ok(!vd.chalkNote(tripPreset('same-direction')).long.includes("lengths don't"));
	assert.equal(vd.chalkNote(tripPreset('there-and-back')), null);
	assert.deepEqual(vd.chalkNote(tripPreset('square-corner')), { long: "the trips add, the lengths don't", short: "trips add, lengths don't" });
	assert.equal(vd.ochreElement(tripPreset('there-and-back')), null);
	assert.ok(vd.planeLabels(tripPreset('there-and-back')).some((label) => label.text === 'zero vector'));
	// When b runs straight back along a, their labels sit on opposite sides of the shared line.
	const backLabels = vd.planeLabels(tripPreset('there-and-back'));
	const labelAt = (labels, id) => labels.find((label) => label.id === id).at;
	assert.ok(vm.cross([3, 2], labelAt(backLabels, 'a')) * vm.cross([3, 2], labelAt(backLabels, 'b')) < 0);
	assert.deepEqual(vd.readoutLines(tripPreset('same-direction')), ['a = (2, 1), b = (2, 1), a + b = (4, 2).', 'Both trips point the same way, so here the lengths do add: √5 + √5 = √20 ≈ 4.47.']);
	assert.deepEqual(vd.readoutLines(tripPreset('square-corner')), ['a = (3, 0), b = (0, 4), a + b = (3, 4).', "Length of a + b: 5. The two trips' lengths add to 3 + 4 = 7."]);
	assert.deepEqual(vd.readoutLines(vst.reducer(tripPreset('there-and-back'), { type: 'stage', stage: 'trips' })).at(-1), 'Both trips: you end where you started.');
	// Overlapping handles are named in the end-of-interaction sentence.
	const stacked = vst.reducer(tripsArrows, moveTo('sum', [3, 2]));
	assert.deepEqual(stacked.b, [0, 0]);
	assert.equal(vd.handleAnnouncement(stacked, 'sum'), 'b = (0, 0). a + b = (3, 2). Both handles are at (3, 2).');
	// The same handles keep the same array, so the plane's memoized move handlers survive a drag.
	assert.equal(vst.handleIds(aMoved), vst.handleIds(tripsArrows));
	// Reset covers the answer again.
	const tripsReset = vst.reducer(tripsDone, { type: 'reset' });
	assert.deepEqual(tripsReset, vst.initialState('trips-add'));

	// ---- trips-scale ----
	const scaleOpen = vst.initialState('trips-scale');
	assert.equal(scaleOpen.stage, 'arrows');
	assert.ok(vst.stageAllowed(scaleOpen, 'lists') && !vst.stageAllowed(scaleOpen, 'trips'));
	assert.equal(vd.statusLine(scaleOpen), 'Goal: find the c that turns a around without changing its length. Then press Check.');
	assert.deepEqual(vd.readoutLines(scaleOpen), ['c = 1. c a = (2, 1).']);
	assert.deepEqual(vd.presetsFor(scaleOpen), []);
	assert.equal(vd.ochreElement(scaleOpen), 'scaled');
	assert.equal(vd.scalarDescription(1.5), 'scale c, 1.5');
	assert.equal(vd.scalarFormat(-0.5), '−0.5');
	// Before Check the readout gives coordinates only, never the verdict words.
	for (const c of [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]) {
		const state = runVec('trips-scale', { type: 'scalar', value: c });
		assertNone(answerFreeText(state), ['opposite', 'same length', 'same direction', 'times as long', 'half as long', 'no direction'], `trips-scale c = ${c}`);
		assertNone([vd.announcementFor(state, { type: 'scalar', value: c })], ['opposite', 'same length'], `trips-scale commit c = ${c}`);
	}
	assert.equal(vd.announcementFor(runVec('trips-scale', { type: 'scalar', value: -1 }), { type: 'scalar', value: -1 }), 'c = −1. c a = (−2, −1).');
	assert.throws(() => vst.reducer(scaleOpen, { type: 'scalar', value: 0.3 }), /step of 0.5/);
	assert.throws(() => vst.reducer(scaleOpen, { type: 'scalar', value: 9 }), /outside −2 to 2/);
	const scaleCheck = (c) => runVec('trips-scale', { type: 'scalar', value: c }, { type: 'check' });
	assert.equal(vd.feedbackLine(scaleCheck(-1)), 'Yes. −1 × a = (−2, −1): the same length as a, pointing the opposite way.');
	assert.equal(vd.feedbackLine(scaleCheck(1)), 'Not quite. 1 × a is a itself. Find a c that turns it around.');
	assert.equal(vd.feedbackLine(scaleCheck(0)), 'Not quite. 0 × a is the zero vector: it has no direction and no length left.');
	assert.equal(vd.feedbackLine(scaleCheck(2)), 'Not quite. A positive c keeps the direction of a. Try a negative c.');
	assert.equal(vd.feedbackLine(scaleCheck(-2)), 'Not quite. A negative c turns a around, but c = −2 also makes it 2 times as long.');
	assert.equal(vd.feedbackLine(scaleCheck(-0.5)), 'Not quite. A negative c turns a around, but c = −0.5 also makes it half as long.');
	const scaleShown = runVec('trips-scale', { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
	assert.equal(scaleShown.scalar, -1);
	assert.equal(vd.feedbackLine(scaleShown), 'Here it is. −1 × a = (−2, −1): the same length as a, pointing the opposite way.');
	// After Check: the qualitative readouts, and the presets.
	const scaleDone = scaleCheck(-1);
	assert.deepEqual(vd.presetsFor(scaleDone).map((preset) => preset.label), ['Double', 'Half', 'Turn around', 'Zero']);
	const scalePreset = (id) => vd.readoutLines(vst.reducer(scaleDone, { type: 'preset', id }));
	assert.deepEqual(scalePreset('double'), ['2 × a = (4, 2): same direction as a, 2 times as long. Length 2 × √5 ≈ 4.47.']);
	assert.deepEqual(scalePreset('half'), ['0.5 × a = (1, 0.5): same direction as a, half as long.']);
	assert.deepEqual(scalePreset('turn-around'), ['−1 × a = (−2, −1): opposite direction, same length.']);
	assert.deepEqual(scalePreset('zero'), ['0 × a = (0, 0): the zero vector. It has no direction.']);
	assert.equal(vd.ochreElement(vst.reducer(scaleDone, { type: 'preset', id: 'zero' })), null);
	assert.deepEqual(vd.readoutLines(runVec('trips-scale', { type: 'check' }, { type: 'check' }, { type: 'show-answer' }, { type: 'scalar', value: 1 })), ['1 × a = (2, 1): the same as a.']);
	assert.deepEqual(vd.readoutLines(vst.reducer(scaleDone, { type: 'scalar', value: -1.5 })), ['−1.5 × a = (−3, −1.5): opposite direction, 1.5 times as long. Length 1.5 × √5 ≈ 3.35.']);
	assert.deepEqual(vd.tableRows(vst.reducer(scaleDone, { type: 'preset', id: 'half' })).map((row) => [row.name, row.x, row.y, row.length]), [
		['a', '2', '1', '√5 ≈ 2.24'],
		['c a', '1', '0.5', '≈ 1.12'],
	]);
	// a stays within ±2, so c a never leaves the board.
	assert.deepEqual(runVec('trips-scale', ...steps('a', 'x', 1, 3)).a, [2, 1]);
	assert.equal(vd.refusalText(runVec('trips-scale'), { kind: 'limit', id: 'a', axis: 'x', direction: 1 }), "a can't go further east: its entries stay between −2 and 2.");
	assert.equal(vd.listsLine(vst.reducer(scaleOpen, { type: 'stage', stage: 'lists' })), 'c a = (1 × 2, 1 × 1) = (2, 1)');
	assert.equal(vd.listsLine(runVec('trips-scale', { type: 'stage', stage: 'lists' }, { type: 'scalar', value: -1.5 })), 'c a = ((−1.5) × 2, (−1.5) × 1) = (−3, −1.5)');

	// ---- cart-push ----
	const cartOpen = vst.initialState('cart-push');
	assert.equal(vd.statusLine(cartOpen), 'Goal: keep your push at length 5, and tilt it so the cart gets only 3 of it. Then press Check.');
	assert.deepEqual(vd.readoutLines(cartOpen), ['Your push: (5, 0), length 5.']);
	assert.deepEqual(vd.handlesFor(cartOpen).map((handle) => handle.label), ['Tip of your push. Its position is in the table below']);
	assert.equal(vd.ochreElement(cartOpen), null);
	assert.ok(vd.planeLabels(cartOpen).some((label) => label.text === 'û, length 1'));
	assert.ok(vd.planeLabels(cartOpen).some((label) => label.text === 'length 5'));
	for (const push of [[5, 0], [3, 4], [-3, 4], [0, 5], [4, 4]]) {
		const state = runVec('cart-push', moveTo('a', push));
		assertNone(answerFreeText(state), ['Along the track', 'Into the rails', 'moves the cart', 'into the rails', 'a · û'], `cart-push push ${push}`);
		assertNone([vd.announcementFor(state, moveTo('a', push))], ['Along the track', 'Into the rails', 'gets'], `cart-push announce ${push}`);
	}
	const cartCheck = (push) => runVec('cart-push', moveTo('a', push), { type: 'check' });
	assert.equal(vd.feedbackLine(cartCheck([3, 4])), 'Yes. (3, 4) has length 5, since 3 × 3 + 4 × 4 = 25, and 3 of it points along the track.');
	assert.equal(vd.feedbackLine(cartCheck([3, -4])), 'Yes. (3, −4) has length 5, since 3 × 3 + (−4) × (−4) = 25, and 3 of it points along the track.');
	assert.equal(vd.feedbackLine(cartCheck([4, 4])), 'Not quite. Your push (4, 4) has length √32 ≈ 5.66, not 5. Stay on the dotted circle.');
	assert.equal(vd.feedbackLine(cartCheck([4, 3])), 'Not quite. (4, 3) has length 5, but 4 of it points along the track. Tilt it further from the track.');
	assert.equal(vd.feedbackLine(cartCheck([0, 5])), 'Not quite. (0, 5) has length 5, but 0 of it points along the track. Tilt it back toward the track.');
	assert.equal(vd.feedbackLine(cartCheck([-3, 4])), 'Not quite. (−3, 4) has length 5, but its part along the track is −3: it rolls the cart backward. Point it forward.');
	const cartShown = runVec('cart-push', { type: 'check' }, { type: 'check' }, { type: 'show-answer' });
	assert.deepEqual(cartShown.a, [3, 4]);
	assert.equal(vd.feedbackLine(cartShown), 'Here it is. (3, 4) has length 5, since 3 × 3 + 4 × 4 = 25, and 3 of it points along the track.');
	const cartDone = cartCheck([3, 4]);
	assert.equal(vd.ochreElement(cartDone), 'shadow');
	assert.deepEqual(vd.readoutLines(cartDone), ['Along the track: a · û = 3 × 1 + 4 × 0 = 3. The cart gets 3 of your push.', "Into the rails: 4. That part doesn't move the cart."]);
	// "Into the rails" is unsigned: pushing down into the rails is still 4.
	assert.deepEqual(vd.readoutLines(cartCheck([3, -4])), ['Along the track: a · û = 3 × 1 + (−4) × 0 = 3. The cart gets 3 of your push.', "Into the rails: 4. That part doesn't move the cart."]);
	assert.ok(vd.planeLabels(cartDone).some((label) => label.text === 'moves the cart'));
	assert.ok(vd.planeLabels(cartDone).some((label) => label.text === 'into the rails'));
	assert.deepEqual(vd.chalkNote(cartDone), { long: 'only the part along the track moves it', short: 'only the track part counts' });
	assert.deepEqual(vd.presetsFor(cartDone).map((preset) => preset.label), ['Sideways', 'Backward', 'Longer track arrow', 'Tilted track']);
	const cartPreset = (id) => vd.readoutLines(vst.reducer(cartDone, { type: 'preset', id }));
	assert.deepEqual(cartPreset('sideways'), ["Along the track: a · û = 0 × 1 + 5 × 0 = 0. The cart doesn't move: your whole push goes into the rails.", "Into the rails: 5. That part doesn't move the cart."]);
	assert.deepEqual(cartPreset('backward'), ['Along the track: a · û = (−3) × 1 + 4 × 0 = −3. The cart rolls backward.', "Into the rails: 4. That part doesn't move the cart."]);
	assert.deepEqual(cartPreset('longer-track'), [
		'a · b = 3 × 2 + 4 × 0 = 6. That is twice the part along the track, 3, because b has length 2. Divide by the length of b: 6 ÷ 2 = 3.',
		"Into the rails: 4. That part doesn't move the cart.",
	]);
	assert.deepEqual(cartPreset('tilted-track'), [
		'a · b = 5 × 4 + 0 × 3 = 20. That is 5 times the part along the track, 4, because b has length 5. Divide by the length of b: 20 ÷ 5 = 4.',
		"Into the rails: 3. That part doesn't move the cart.",
	]);
	assert.ok(vd.planeLabels(vst.reducer(cartDone, { type: 'preset', id: 'longer-track' })).some((label) => label.text === 'b, length 2'));
	// On the tilted track the push's label goes below it, away from the track, and the shadow's label sits inside the
	// triangle the push makes with the track.
	const tiltedLabels = vd.planeLabels(vst.reducer(cartDone, { type: 'preset', id: 'tilted-track' }));
	assert.ok(labelAt(tiltedLabels, 'a')[1] < 0);
	assert.ok(vm.cross([4, 3], labelAt(tiltedLabels, 'shadow')) < 0);
	// On the tilted track a push near (5, 5) throws its shadow past the edge, and the readout says so.
	const offBoardState = runVec('cart-push', moveTo('a', [3, 4]), { type: 'check' }, { type: 'preset', id: 'tilted-track' }, moveTo('a', [5, 5]));
	const offBoard = vd.readoutLines(offBoardState)[0];
	assert.ok(offBoard.endsWith('The shadow runs past the edge of the board.'), offBoard);
	// The drawing matches: the shadow stops at the edge, and the line into the rails (past the edge too) and its label
	// are left out. The true tip is (5.6, 4.2).
	const near = (v, expected) => v.every((value, index) => Math.abs(value - expected[index]) < 1e-9);
	assert.ok(near(vm.clipToView([5.6, 4.2]), [5, 3.75]));
	assert.deepEqual(vm.clipToView([3, -4]), [3, -4]);
	const offBoardShadow = vd.cartShadow(offBoardState);
	assert.ok(near(offBoardShadow.tip, [5, 3.75]) && offBoardShadow.onBoard === false);
	assert.ok(!vd.planeLabels(offBoardState).some((label) => label.id === 'rails'));
	assert.ok(vd.planeLabels(offBoardState).every((label) => vm.withinView(label.at)));
	assert.deepEqual(vd.cartShadow(cartDone), { tip: [3, 0], onBoard: true });
	assert.equal(vd.cartShadow(cartOpen), null);
	assert.equal(vd.handleAnnouncement(cartDone, 'a'), 'Your push: (3, 4), length 5. The cart gets 3 of it.');
	assert.equal(vd.handleAnnouncement(vst.reducer(cartDone, moveTo('a', [-3, 4])), 'a'), 'Your push: (−3, 4), length 5. Its part along the track is −3: the cart rolls backward.');

	// ---- align ----
	const alignOpen = vst.initialState('align');
	assert.deepEqual(vd.readoutLines(alignOpen), ['a = (4, 1), b = (−1, 3).']);
	assert.deepEqual(vd.handlesFor(alignOpen), []);
	assert.equal(vd.ochreElement(alignOpen), null);
	assert.equal(alignOpen.signGuess, null);
	assertNone(answerFreeText(alignOpen), ['a · b =', '°', 'Shadow', 'shadow', 'θ', 'perpendicular'], 'align before Check');
	assertNone(answerFreeText(vst.reducer(alignOpen, { type: 'sign', sign: 'zero' })), ['a · b =', '°', 'Shadow'], 'align after a sign');
	// Check is refused, with a visible reason, until a sign is picked.
	const noSign = vst.reducer(alignOpen, { type: 'check' });
	assert.equal(noSign.checked, false);
	assert.equal(noSign.refusal?.kind, 'no-sign');
	assert.equal(vd.announcementFor(noSign, { type: 'check' }), 'Pick positive, zero or negative first.');
	assert.equal(vd.checkRefusal(alignOpen), 'Pick positive, zero or negative first.');
	assert.equal(vd.checkRefusal(vst.reducer(alignOpen, { type: 'sign', sign: 'zero' })), null);
	assert.equal(vst.stepRefusal(alignOpen, 'b', 'x', 1)?.kind, 'locked');
	assert.equal(vst.reducer(alignOpen, moveTo('a', [3, 1])), alignOpen);
	// One shot: any answer reveals.
	const signCheck = (sign) => runVec('align', { type: 'sign', sign }, { type: 'check' });
	assert.equal(vd.feedbackLine(signCheck('negative')), 'Yes. a · b = 4 × (−1) + 1 × 3 = −1, so it is negative. The angle is about 94.4°, just over a right angle.');
	assert.equal(vd.feedbackLine(signCheck('zero')), 'Not quite. It looks like a right angle, but a · b = 4 × (−1) + 1 × 3 = −1, not 0. The angle is about 94.4°.');
	assert.equal(vd.feedbackLine(signCheck('positive')), 'Not quite. a · b = 4 × (−1) + 1 × 3 = −1. It is negative because the angle, about 94.4°, is over 90°.');
	for (const sign of ['negative', 'zero', 'positive']) assert.ok(signCheck(sign).checked);
	assert.equal(vst.reducer(signCheck('zero'), { type: 'sign', sign: 'negative' }).signGuess, 'zero');
	const alignDone = signCheck('negative');
	assert.deepEqual(vd.handlesFor(alignDone).map((handle) => handle.label), ['Tip of vector a. Its position is in the table below', 'Tip of vector b. Its position is in the table below']);
	assert.equal(vd.ochreElement(alignDone), 'shadow');
	assert.deepEqual(vd.readoutLines(alignDone), ['a · b = 4 × (−1) + 1 × 3 = −1.', 'Angle: about 94.4°.', 'Shadow of b along a: a · b ÷ ‖a‖ = −1 ÷ √17 ≈ −0.24.']);
	assert.ok(vd.planeLabels(alignDone).some((label) => label.text === 'θ'));
	assert.deepEqual(vd.chalkNote(alignDone), { long: 'wider than a right angle: negative', short: 'past a right angle: negative' });
	// The note follows the current a and b, so a preset or a drag never leaves a stale "negative" next to the readouts.
	const alignNoteAfter = (id) => vd.chalkNote(vst.reducer(alignDone, { type: 'preset', id }));
	assert.ok(!alignNoteAfter('short-b').long.includes('negative') && !alignNoteAfter('short-b').short.includes('negative'));
	assert.deepEqual(alignNoteAfter('short-b'), { long: 'narrower than a right angle: positive', short: 'under a right angle: positive' });
	assert.deepEqual(alignNoteAfter('long-b'), { long: 'narrower than a right angle: positive', short: 'under a right angle: positive' });
	assert.deepEqual(alignNoteAfter('perpendicular'), { long: 'a right angle: zero', short: 'right angle: zero' });
	assert.deepEqual(alignNoteAfter('opposite'), { long: 'wider than a right angle: negative', short: 'past a right angle: negative' });
	assert.equal(vd.chalkNote(vst.initialState('align')), null);
	assert.deepEqual(vd.presetsFor(alignDone).map((preset) => preset.label), ['Perpendicular', 'Opposite', 'Short b', 'Long b']);
	const alignPreset = (...ids) => vd.readoutLines(ids.reduce((state, id) => vst.reducer(state, { type: 'preset', id }), alignDone));
	assert.deepEqual(alignPreset('perpendicular').slice(0, 2), ['a · b = 3 × (−1) + 1 × 3 = 0.', 'Exactly 90°: a and b are perpendicular.']);
	assert.ok(!vd.planeLabels(vst.reducer(alignDone, { type: 'preset', id: 'perpendicular' })).some((label) => label.text === 'θ'));
	assert.deepEqual(alignPreset('opposite').slice(0, 2), ['a · b = 2 × (−4) + 1 × (−2) = −10.', 'Exactly 180°: b points the opposite way.']);
	assert.deepEqual(alignPreset('short-b').slice(0, 2), ['a · b = 3 × 1 + 1 × 2 = 5.', 'Exactly 45°.']);
	assert.deepEqual(alignPreset('long-b').slice(0, 2), ['a · b = 3 × 2 + 1 × 4 = 10.', 'Exactly 45°.']);
	assert.equal(alignPreset('short-b', 'long-b').at(-1), 'Before: a · b = 5 at exactly 45°. Same angle, b twice as long, so a · b doubled.');
	assert.ok(!alignPreset('perpendicular', 'long-b').at(-1).includes('doubled'));
	// Announcements say the symbols the way the notation registry does, so a screen reader can't drop ‖ or ·; the
	// visible readouts keep the symbols.
	const spokenPreset = vd.announcementFor(vst.reducer(alignDone, { type: 'preset', id: 'short-b' }), { type: 'preset', id: 'short-b' });
	assert.ok(spokenPreset.includes('Shadow of b along a: a dot b ÷ the length of a = 5 ÷ √10 ≈ 1.58.'), spokenPreset);
	assert.ok(!/[‖·θû]/.test(spokenPreset));
	assert.equal(vd.announcementFor(alignOpen, { type: 'sign', sign: 'zero' }), 'Your guess: a dot b is zero.');
	assert.equal(vd.spoken('Along the track: a · û = 3. θ'), 'Along the track: a dot u hat = 3. theta');
	for (const id of Object.keys(vs.SETUPS)) {
		for (const action of [{ type: 'check' }, { type: 'reset' }, { type: 'stage', stage: 'arrows' }]) {
			assert.ok(!/[‖·θû]/.test(vd.announcementFor(runVec(id, action), action)), `${id} ${action.type}`);
		}
	}
	// A zero vector before a preset reads as a sentence, never "at with no angle".
	const fromZero = vst.reducer({ ...alignDone, activePreset: 'perpendicular', b: [0, 0] }, { type: 'preset', id: 'long-b' });
	assert.equal(vd.readoutLines(fromZero).at(-1), 'Before: a · b = 0, with no angle.');
	// The shadow readout uses ‖a‖ for a length and keeps exact roots exact.
	assert.equal(alignPreset('short-b')[2], 'Shadow of b along a: a · b ÷ ‖a‖ = 5 ÷ √10 ≈ 1.58.');
	// A zero vector: a · b is 0 and the angle is undefined, never 0° or 90°.
	const zeroB = runVec('align', { type: 'sign', sign: 'zero' }, { type: 'check' }, moveTo('b', [0, 0]));
	assert.deepEqual(vd.readoutLines(zeroB), ['a · b = 0 because b is the zero vector. The angle is undefined: b has no direction.']);
	assertNone(allText(zeroB), ['0°', '90°'], 'align with a zero b');
	assert.equal(vd.handleAnnouncement(zeroB, 'b'), 'a = (4, 1), b = (0, 0). a dot b = 0. The angle is undefined: b has no direction.');
	assert.equal(vd.ochreElement(zeroB), null);
	assert.equal(vd.chalkNote(zeroB), null);
	assert.equal(vd.handleAnnouncement(vst.reducer(alignDone, { type: 'preset', id: 'perpendicular' }), 'a'), 'a = (3, 1), b = (−1, 3). a dot b = 0. Exactly 90°: perpendicular.');
	assert.equal(vd.handleAnnouncement(vst.reducer(alignDone, moveTo('b', [4, 1])), 'b'), "a = (4, 1), b = (4, 1). a dot b = 17. Exactly 0°: same direction. b can't go further east: its entries stay between −4 and 4. Both handles are at (4, 1).");
	// b stays within ±4, so its shadow along a never leaves the board.
	assert.deepEqual(vst.reducer(alignDone, moveTo('b', [5, 5])).b, [4, 4]);
	assert.equal(vd.refusalText(alignDone, { kind: 'limit', id: 'b', axis: 'y', direction: 1 }), "b can't go further north: its entries stay between −4 and 4.");

	// Plane labels stay inside the plane at every position the handles can reach, at the narrowest plane (about 270px
	// on a 320px phone) and the widest (440px). fitLabel moves a label that would cross the edge, never the arrow it names.
	const PLANE_SIZES = [270, 440];
	const labelFits = (label, size) => {
		const fitted = vm.fitLabel(label.at, label.away, label.text, size);
		const [left, right] = vm.fittedLabelSpan(fitted, label.text, size);
		const [, halfHeight] = vm.labelHalfSize(label.text, size);
		const reach = vm.labelReach(size) + 1e-9;
		return left >= -reach && right <= reach && Math.abs(fitted.at[1]) + halfHeight <= reach;
	};
	const grid = (limit) => Array.from({ length: 2 * limit + 1 }, (_, index) => index - limit).flatMap((x) => Array.from({ length: 2 * limit + 1 }, (_, index) => [x, index - limit]));
	/** Every a, b, guess and c the setup's boxes allow, before and after Check, on every stage it offers. */
	function* reachableStates(id) {
		const setup = vs.getSetup(id);
		const open = vst.initialState(id);
		const stages = setup.stages.length > 0 ? setup.stages : [setup.openingStage];
		const tracks = setup.kind === 'cart' ? [...new Set([setup.opening.b, ...setup.presets.map((preset) => preset.b)].map(String))].map((text) => text.split(',').map(Number)) : null;
		const scalars = setup.scaleRange ? Array.from({ length: Math.round((setup.scaleRange.max - setup.scaleRange.min) / setup.scaleRange.step) + 1 }, (_, index) => setup.scaleRange.min + index * setup.scaleRange.step) : [open.scalar];
		for (const stage of stages) {
			for (const checked of [false, true]) {
				const base = { ...open, stage, checked, otherOrder: checked };
				for (const a of grid(setup.limitA)) {
					if (setup.kind === 'add' && !checked) {
						if (a[0] !== open.a[0] || a[1] !== open.a[1]) continue;
						for (const guess of grid(vm.VIEW_LIMIT)) yield { ...base, guess };
						continue;
					}
					const bs = tracks ?? grid(setup.limitB);
					for (const b of bs) {
						if (setup.kind === 'add' && !vm.withinView(vm.add(a, b))) continue;
						for (const scalar of scalars) yield { ...base, a, b, scalar };
					}
				}
			}
		}
	}
	for (const id of Object.keys(vs.SETUPS)) {
		let count = 0;
		for (const state of reachableStates(id)) {
			for (const label of vd.planeLabels(state)) {
				for (const size of PLANE_SIZES) assert.ok(labelFits(label, size), `${id}: "${label.text}" leaves a ${size}px plane at a = (${state.a}), b = (${state.b}), guess = (${state.guess}), c = ${state.scalar}`);
			}
			count++;
		}
		assert.ok(count > 0, `${id}: no states swept`);
	}
	// labelAnchor is the arrow's middle plus labelAway's unit step.
	assert.deepEqual(vm.labelAway([0, 0], [4, 0], 1), [0, 1]);
	assert.deepEqual(vm.labelAway([0, 0], [0, 5], -1), [1, 0]);
	assert.deepEqual(vm.labelAway([2, 2], [2, 2], 1), [0, 1]);
	// A label that already fits stays centered where planeLabels put it.
	assert.deepEqual(vm.fitLabel([1, 1], [0, 1], 'a', 440), { at: [1, 1], attach: 'center' });
	// cart-push with push (5, 5): "into the rails" named the line at x = 5 from outside it, past the edge. It moves to the
	// inner side and ends before the line, so its text stays clear of it.
	const railsState = runVec('cart-push', moveTo('a', [3, 4]), { type: 'check' }, moveTo('a', [5, 5]));
	const rails = vd.planeLabels(railsState).find((label) => label.id === 'rails');
	for (const size of PLANE_SIZES) {
		const fitted = vm.fitLabel(rails.at, rails.away, rails.text, size);
		assert.equal(fitted.attach, 'w');
		assert.ok(vm.fittedLabelSpan(fitted, rails.text, size)[1] < 5, `rails label crosses its line at ${size}px`);
	}
	// trips-add after Check with a = (−5, −5), b = (1, 0): trip b's label sat below the bottom edge; it moves above b.
	const lowTrip = vd.planeLabels({ ...vst.initialState('trips-add'), checked: true, a: [-5, -5], b: [1, 0] }).find((label) => label.id === 'b');
	assert.ok(lowTrip.at[1] < -5);
	assert.ok(vm.fitLabel(lowTrip.at, lowTrip.away, lowTrip.text, 440).at[1] > -5);
	assert.throws(() => vm.fitLabel([0, 0], null, 'a', 0), /wider than 0px/);

	// ---- Every setup ----
	const bannedWord = new RegExp(['pro', 'mpt'].join(''), 'i');
	for (const id of Object.keys(vs.SETUPS)) {
		const open = vst.initialState(id);
		// Exactly one ochre element at a time, and nothing pink or blue.
		assert.ok([null, 'guess', 'sum', 'scaled', 'shadow'].includes(vd.ochreElement(open)));
		// Handles and steppers agree: every handle's point is in the table, and every label ends without a period.
		for (const handle of vd.handlesFor(open)) assert.ok(!handle.label.endsWith('.'), handle.label);
		// No em dash, and never the word the site's style bans for a question put to the reader (spelled in parts
		// so this file doesn't contain it).
		const states = [open, runVec(id, { type: 'check' }), runVec(id, { type: 'sign', sign: 'negative' }, { type: 'check' }, { type: 'check' }, { type: 'show-answer' })];
		for (const state of states) {
			for (const text of allText(state)) {
				assert.ok(!text.includes('—'), `${id}: em dash in "${text}"`);
				assert.ok(!bannedWord.test(text), `${id}: "${text}"`);
				// ‖a‖ is a length; |…| is kept for a number's absolute value, and · only for the dot product.
				assert.ok(!/\|[ab]\||\|a \+ b\|/.test(text), `${id}: single bars around a vector in "${text}"`);
				assert.ok(!/(?:\d|c)\s?·\s?a/.test(text), `${id}: a scalar multiple written with · in "${text}"`);
			}
		}
	}
	// The board's files never use the μ or σ colors, and never render KaTeX.
	const vectorFiles = ['src/components/react/VectorBoard2D.tsx', ...readdirSync('src/components/react/vectorBoard').map((name) => `src/components/react/vectorBoard/${name}`)];
	for (const file of vectorFiles) {
		const source = readFileSync(file, 'utf8');
		assert.ok(!/\bmu\b|sigma|--ms-mu|--ms-sigma/.test(source), `${file} uses a μ or σ color`);
		assert.ok(!source.includes('<LaTeX'), `${file} renders KaTeX`);
	}
}

console.log('Board check passed.');
