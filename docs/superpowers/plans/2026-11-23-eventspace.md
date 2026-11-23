# EventSpace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the EventSpace board, v1 (count and weights modes, Check with HT/TH feedback) and v1.1 (tosses, the wrong-model view, picture/letters/sets stages), ready for the week-1 probability pages.

**Architecture:** A React island that renders an HTML outcome table and a tray inside the existing `Board`. All math, copy and state transitions live in pure TypeScript modules (`model.ts`, `describe.ts`, `state.ts`) with no React, checked by a `node:assert` script that runs before every build. The island selects everything by one `setup` string prop.

**Tech Stack:** Astro 7 + Starlight, React 19 islands (`client:visible`), TypeScript strict, plain CSS with `--ms-*` tokens in `src/styles/components.css`, Node 24 (runs `.ts` directly).

**Spec:** `docs/superpowers/specs/2026-11-23-eventspace-design.md` (approved 2026-11-23). Read it first; this plan only adds the decisions it leaves to the builder.

## Global Constraints

- American English in all copy and code (decision 0010).
- Colors only from `--ms-*` tokens; never pink (`--ms-mu`) or blue (`--ms-sigma`); every cue doubled by shape or text.
- No KaTeX in the island (decision 0007); math in plain Unicode ("P(A | B)", "Ω").
- No shadows other than the site focus ring, no left bars, no gradients (decision 0006).
- Island used as `<div class="not-content"><EventSpace client:visible setup="…" /></div>`; island CSS in `src/styles/components.css`.
- `Board` gets no code change; EventSpace passes `label`, `tray`, `onReset`, `announcement` and never `onInteractionEnd` or `handleLabels`.
- Pure modules use only erasable TypeScript (no `enum`, `namespace` or parameter properties) and import each other with explicit `.ts` extensions, so Node can run them.
- At most 36 outcomes per scenario and at most 4 presets per event; violations throw with a message naming the setup id.
- Cells at least 44 px at a 375 px viewport and at least 36 px at 320 px, 6 px gap, no horizontal scroll at any width.
- Announcements only when an interaction ends; cell toggles debounced 600 ms (`KEYBOARD_COMMIT_DELAY_MS`).
- No test framework is added. Pure logic is asserted in `scripts/check-boards.mjs`; UI is verified by build, type-check and the manual pass.
- Commits: one imperative line, no attribution; stage files by name.

## Review Focus

1. **A burst of taps or Space presses** announces once, about 600 ms after the last one, with the final count ("You have marked 3 squares"), never an intermediate count. (Task 3, manual step.)
2. **Reset after a passed Check** on `coins-build` re-locks presets and the readout, clears feedback and "missed" marks, and empties A. (Task 2 test `reset relocks a goal setup`.)
3. **Applying a preset or toggling while editing B** on `dice-operations` changes only B; switching "Editing" never changes membership. (Task 2 test `editing B leaves A alone`.)
4. **Pouring at the limits:** out of an empty cup and into a cup with an empty jug are refused with the spec's reasons; weights stay integers from 0 to 12 and the jug never goes negative. (Task 2 tests `pour refusals`.)
5. **A typo in a page's `setup` value** fails the build with a message naming the bad id, instead of rendering an empty board. (Task 1 test `getSetup throws on unknown id`, and Task 3's manual check.)

---

## File structure

| File | Responsibility |
|---|---|
| `src/components/react/eventSpace/model.ts` | Fractions, set operations, probability, goal checking, pouring, tossing, wrong-model pooling. Pure. |
| `src/components/react/eventSpace/scenarios.ts` | Outcome spaces and their named events (data). |
| `src/components/react/eventSpace/setups.ts` | Setups per page (data), `SetupId`, `getSetup()`. |
| `src/components/react/eventSpace/describe.ts` | Every visible and spoken sentence, from state. Pure. |
| `src/components/react/eventSpace/state.ts` | `EventSpaceState`, actions, `initialState()`, `reducer()`. Pure. |
| `src/components/react/eventSpace/OutcomeGrid.tsx` | The outcome table and cells. |
| `src/components/react/eventSpace/useRovingGrid.ts` | Roving-tabindex keyboard navigation for the grid. |
| `src/components/react/eventSpace/CupRow.tsx` | Weights mode cups. |
| `src/components/react/EventSpace.tsx` | Composes Board, grid or cups, and tray; owns the debounced announcement. |
| `src/components/react/TrayChoice.tsx` | Shared segmented choice (fieldset + native radios). |
| `src/components/react/boardTiming.ts` | `KEYBOARD_COMMIT_DELAY_MS = 600`, moved from `TraySlider.tsx`. |
| `scripts/check-boards.mjs` | `node:assert` checks of the pure modules; runs in `prebuild`. |
| `src/content/docs/lab/event-space.mdx` | `draft: true` lab page showing every setup in dev; never built for production. |

---

### Task 1: Model, scenarios, setups and the board check

**Files:**
- Create: `src/components/react/eventSpace/model.ts`, `scenarios.ts`, `setups.ts`, `scripts/check-boards.mjs`
- Modify: `package.json` (scripts `check:boards`; `prebuild` becomes `npm run check:design && npm run check:content && npm run check:boards`)

**Interfaces:**
- Produces (model.ts):
  - `type OutcomeId = string`
  - `interface Outcome { id: OutcomeId; row: number; col: number; label: string; spoken: string }` (`spoken` is lower-case, e.g. "first coin heads, second coin tails")
  - `interface Fraction { numerator: number; denominator: number }`
  - `const WEIGHT_TOTAL = 12`
  - `fraction(numerator: number, denominator: number): Fraction` (reduced by gcd; throws on denominator ≤ 0)
  - `formatFraction(value: Fraction): string` ("3/4"; whole numbers as "0" or "1")
  - `intersect(a, b)`, `union(a, b)`: `(ReadonlySet<OutcomeId>, ReadonlySet<OutcomeId>) => ReadonlySet<OutcomeId>`; `complement(a: ReadonlySet<OutcomeId>, all: readonly Outcome[]): ReadonlySet<OutcomeId>`
  - `probability(event: ReadonlySet<OutcomeId>, all: readonly Outcome[], weights?: Readonly<Record<OutcomeId, number>>): Fraction` (count: |E|/|Ω|; weights: Σw/12)
  - `type GoalResult = { kind: 'correct' } | { kind: 'missed-mirror'; have: OutcomeId; missing: OutcomeId } | { kind: 'extra'; extra: OutcomeId[] } | { kind: 'partial'; found: number; needed: number; wrong: number }`
  - `checkGoal(marked: ReadonlySet<OutcomeId>, goal: ReadonlySet<OutcomeId>, mirrorOf: (id: OutcomeId) => OutcomeId | undefined): GoalResult`. Precedence: equal → `correct`; no extras and every missing cell's mirror is marked → `missed-mirror` (first missing cell in outcome order); nothing missing but extras → `extra`; otherwise `partial`.
  - `type PourResult = { ok: true; weights: Record<OutcomeId, number> } | { ok: false; reason: 'cup-empty' | 'jug-empty' }`
  - `pour(weights: Readonly<Record<OutcomeId, number>>, id: OutcomeId, direction: 1 | -1): PourResult`
- Produces (scenarios.ts): `interface EventDefinition { label: string; members: (outcome: Outcome) => boolean; outsideReason?: string }`, `interface Scenario { id: ScenarioId; rowLabel: string; colLabel: string; rowValues: string[]; colValues: string[]; outcomes: Outcome[]; events: Record<string, EventDefinition>; mirrorOf: (id: OutcomeId) => OutcomeId | undefined; describeSpace: string }`, `type ScenarioId = 'two-coins' | 'one-die' | 'two-dice'`, `SCENARIOS: Record<ScenarioId, Scenario>`. (`coin-and-die` is left to v1.3: no v1 setup uses it.)
- Produces (setups.ts): `type SetupId = 'coins-build' | 'dice-count' | 'dice-operations' | 'die-pour'`, `interface EventSetup { editable: boolean; initial: string | null; presets: string[] }`, `interface Setup { id: SetupId; scenario: ScenarioId; mode: 'count' | 'weights'; label: string; goal?: string; events: { A: EventSetup; B?: EventSetup }; lookAt: boolean; weightPresets?: Record<string, number[]>; initialWeights?: string; stages: boolean; toss: boolean; wrongModel: boolean }`, `getSetup(id: string): Setup` (throws `EventSpace: unknown setup "x". Known setups: …`).

Setup data (from the spec's opening-state table): `coins-build` goal `at-least-one-head`, A empty, presets `at-least-one-head`, `exactly-one-head`, `both-same`, `clear`, `stages`/`toss`/`wrongModel` true; `dice-count` A empty, presets `sum-7`, `sum-2`, `clear`; `dice-operations` A initial `sum-7` (presets `sum-7`, `double`, `clear`), B initial `first-6` (presets `first-6`, `second-6`, `clear`), `lookAt` true; `die-pour` mode `weights`, event presets `even`, `at-most-2`, `six`, weight presets `Fair die` [2,2,2,2,2,2], `Loaded toward six` [1,1,1,1,1,7], `Start over` [0,0,0,0,0,0], initial `Fair die`. `clear` is a built-in preset (the empty event), not a scenario event. `outsideReason` for `at-least-one-head` is "has no head".

- [ ] **Step 1: Write `scripts/check-boards.mjs` with these assertions (failing: modules don't exist)**

```js
import assert from 'node:assert/strict';
import { fraction, formatFraction, probability, checkGoal, pour, intersect, union, complement, WEIGHT_TOTAL } from '../src/components/react/eventSpace/model.ts';
import { SCENARIOS } from '../src/components/react/eventSpace/scenarios.ts';
import { getSetup } from '../src/components/react/eventSpace/setups.ts';

const coins = SCENARIOS['two-coins'];
const dice = SCENARIOS['two-dice'];
const ids = (scenario, event) => new Set(scenario.outcomes.filter(scenario.events[event].members).map((o) => o.id));

// fractions
assert.deepEqual(fraction(6, 36), { numerator: 1, denominator: 6 });
assert.equal(formatFraction(fraction(3, 4)), '3/4');
assert.equal(formatFraction(fraction(0, 4)), '0');
assert.throws(() => fraction(1, 0));
// spaces
assert.deepEqual(coins.outcomes.map((o) => o.label), ['HH', 'HT', 'TH', 'TT']);
assert.equal(coins.outcomes[2].spoken, 'first coin tails, second coin heads');
assert.equal(dice.outcomes.length, 36);
assert.equal(coins.mirrorOf('HT'), 'TH');
// spec numbers
assert.deepEqual(probability(ids(coins, 'at-least-one-head'), coins.outcomes), fraction(3, 4));
assert.deepEqual(probability(ids(dice, 'sum-7'), dice.outcomes), fraction(6, 36));
assert.deepEqual(probability(ids(dice, 'sum-2'), dice.outcomes), fraction(1, 36));
const sum7 = ids(dice, 'sum-7'), first6 = ids(dice, 'first-6');
assert.equal(intersect(sum7, first6).size, 1);
assert.equal(union(sum7, first6).size, 11);
assert.equal(complement(sum7, dice.outcomes).size, 30);
const die = SCENARIOS['one-die'];
assert.deepEqual(probability(ids(die, 'even'), die.outcomes, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 }), fraction(6, 12));
// goal checking
const goal = ids(coins, 'at-least-one-head');
assert.deepEqual(checkGoal(new Set(['HH', 'HT', 'TH']), goal, coins.mirrorOf), { kind: 'correct' });
assert.deepEqual(checkGoal(new Set(['HH', 'HT']), goal, coins.mirrorOf), { kind: 'missed-mirror', have: 'HT', missing: 'TH' });
assert.deepEqual(checkGoal(new Set(['HH', 'HT', 'TH', 'TT']), goal, coins.mirrorOf), { kind: 'extra', extra: ['TT'] });
assert.deepEqual(checkGoal(new Set(['TT']), goal, coins.mirrorOf), { kind: 'partial', found: 0, needed: 3, wrong: 1 });
// pour refusals (Review Focus 4)
const empty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
assert.deepEqual(pour(empty, '3', -1), { ok: false, reason: 'cup-empty' });
const full = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 };
assert.deepEqual(pour(full, '3', 1), { ok: false, reason: 'jug-empty' });
assert.equal(WEIGHT_TOTAL, 12);
// setups (Review Focus 5)
assert.throws(() => getSetup('coins-bild'), /unknown setup "coins-bild"/);
assert.equal(getSetup('coins-build').goal, 'at-least-one-head');
console.log('Board check passed.');
```

- [ ] **Step 2: Run `node scripts/check-boards.mjs`.** Expected: fails with `ERR_MODULE_NOT_FOUND` for `model.ts`.
- [ ] **Step 3: Implement `model.ts`, `scenarios.ts` and `setups.ts` to the interfaces above.** Outcome ids: coins `HH`…`TT`; one die `1`…`6`; two dice `a-b` (e.g. `6-1`) with label `6,1` and spoken "first die 6, second die 1". `getSetup` also asserts at call time that no event has more than 4 presets and every preset id exists on the setup's scenario (or is `clear`).
- [ ] **Step 4: Add the npm script and prebuild, then run `node scripts/check-boards.mjs`.** Expected: `Board check passed.`
- [ ] **Step 5: Run `npm run check`.** Expected: `0 errors`.
- [ ] **Step 6: Commit** `git add src/components/react/eventSpace/model.ts src/components/react/eventSpace/scenarios.ts src/components/react/eventSpace/setups.ts scripts/check-boards.mjs package.json` with "Add the EventSpace model, scenarios and setups with a pre-build board check".

### Task 2: State and copy

**Files:**
- Create: `src/components/react/eventSpace/state.ts`, `src/components/react/eventSpace/describe.ts`
- Modify: `scripts/check-boards.mjs` (append)

**Interfaces:**
- Consumes: Task 1.
- Produces (state.ts):
  - `type EventKey = 'A' | 'B'`, `type LookAt = 'everything' | 'A and B' | 'A or B' | 'not A'`
  - `interface EventSpaceState { setupId: SetupId; events: Record<EventKey, ReadonlySet<OutcomeId>>; editing: EventKey; lookAt: LookAt; checked: boolean; failedChecks: number; feedback: GoalResult | null; weights: Record<OutcomeId, number>; refusal: { id: OutcomeId; reason: 'cup-empty' | 'jug-empty' } | null; tallies: Record<OutcomeId, number>; tossCount: number; wrongModel: boolean; stage: 'picture' | 'letters' | 'sets' }`
  - `type Action = { type: 'toggle'; id: OutcomeId } | { type: 'preset'; event: EventKey; preset: string } | { type: 'edit'; event: EventKey } | { type: 'look'; lookAt: LookAt } | { type: 'check' } | { type: 'show-answer' } | { type: 'reset' } | { type: 'pour'; id: OutcomeId; direction: 1 | -1 } | { type: 'weight-preset'; name: string }` (Task 6 and 7 add `toss`, `wrong-model`, `stage`)
  - `initialState(setupId: SetupId): EventSpaceState`, `reducer(state: EventSpaceState, action: Action): EventSpaceState`
  - `isLocked(state: EventSpaceState): boolean` (goal setup and not yet passed)
- Produces (describe.ts), each returning plain strings:
  - `statusLine(state): string`, `feedbackLine(state): string | null`, `readoutLines(state): string[]`, `cellName(state, outcome): string`, `announcementFor(state, action: Action): string`, `refusalText(reason): string`

Rules the reducer must follow: a preset is refused (state unchanged) while `isLocked`; `check` sets `feedback` and, when correct, `checked: true`; `show-answer` is allowed only when `failedChecks >= 2`, sets A to the goal and `checked: true`; `reset` returns `initialState(setupId)`; `pour` stores `refusal` instead of changing weights when refused, and clears `refusal` on the next successful action.

Exact copy (from the spec), asserted below: status before Check on `coins-build`: "4 equally likely outcomes. Event A: at least one head. Tap the squares that belong to A."; marked count: "You have marked 2 squares." (1 → "1 square"); correct: "Yes: HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75."; missed mirror: "Not yet. You have HT but not TH. First coin tails, second coin heads is a different way to land from first coin heads, second coin tails."; extra: "TT has no head; remove it."; partial: "You have 0 of the squares A needs, and 1 that don't belong."; readout after Check: "A = {HH, HT, TH}. 3 of 4 outcomes. P(A) = 3/4 = 0.75."; `dice-operations` readouts include "not A: 30 of 36", "A and B = {(6,1)}: 1 of 36", "A or B: 6 + 6 − 1 = 11 of 36 = 0.31"; cell name "HT. First coin heads, second coin tails. In A."; refusals "A cup can't hold less than nothing." and "The jug is empty."; weights total line "All 12 units poured: the cups add up to 1." or "8 of 12 units poured. The cups add up to 8/12, not 1, so this isn't a probability yet." (8/12 stays unreduced here, because it describes units). Decimals use `formatNumber` from `plotColors.ts` with 2 places, prefixed "≈" only when rounding changed the value. Member lists longer than 8 show the first 8 and "and k more".

- [ ] **Step 1: Append assertions to `scripts/check-boards.mjs`:** every exact sentence above, plus the tests named in Review Focus: `reset relocks a goal setup` (check correct → reset → `isLocked` true, `feedback` null, A empty), `editing B leaves A alone` (on `dice-operations`, `edit B` then `toggle 1-1` and `preset B second-6` leave `events.A` equal to the sum-7 set), `presets locked before Check` (preset on fresh `coins-build` returns the same state object), `show answer needs two failed checks`, and `pour refusals` (refused pour keeps weights and sets `refusal.reason`).
- [ ] **Step 2: Run `node scripts/check-boards.mjs`.** Expected: fails importing `state.ts`.
- [ ] **Step 3: Implement `state.ts` and `describe.ts` to the interfaces and rules above.** State stays immutable: every action returns a new object; sets are replaced, never mutated.
- [ ] **Step 4: Run `node scripts/check-boards.mjs` and `npm run check`.** Expected: `Board check passed.` and `0 errors`.
- [ ] **Step 5: Commit** the two new files and the script with "Add EventSpace state transitions and every sentence it shows or speaks".

### Task 3: The count-mode board

**Files:**
- Create: `src/components/react/boardTiming.ts`, `src/components/react/TrayChoice.tsx`, `src/components/react/eventSpace/useRovingGrid.ts`, `src/components/react/eventSpace/OutcomeGrid.tsx`, `src/components/react/EventSpace.tsx`, `src/content/docs/lab/event-space.mdx`
- Modify: `src/components/react/TraySlider.tsx:5` (import the constant instead of defining it), `src/styles/components.css` (append `.ms-event-*` and `.ms-choice`), `src/design/palette.mjs` (contrast rules `['boardInk', 'highlight', 'text']` and `['attention', 'highlight', 'graphic']`)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `export default function EventSpace({ setup }: { setup: SetupId })`; `export default function TrayChoice<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void })`; `useRovingGrid(rows: number, cols: number): { focused: [number, number]; tabIndexFor(row: number, col: number): 0 | -1; onKeyDown(event: KeyboardEvent<HTMLTableElement>): void; register(row: number, col: number): (element: HTMLButtonElement | null) => void }`; `export const KEYBOARD_COMMIT_DELAY_MS = 600`.

- [ ] **Step 1: Run `npm run check:design` after adding the two contrast rules to `palette.mjs`.** Expected: passes. If either rule fails, remove the A fill from the CSS in Step 3 (the spec's fallback) and record that in Task 5's decision record.
- [ ] **Step 2: Move `KEYBOARD_COMMIT_DELAY_MS` to `boardTiming.ts`; build `TrayChoice`, `useRovingGrid`, `OutcomeGrid` and `EventSpace`** following the spec's Look and Interaction sections: `<table role="grid" aria-multiselectable="true">`, `<th scope>` headers, `<button aria-pressed>` per cell named by `cellName()`, arrows without wrap, Home/End, Ctrl+Home/End, Space/Enter; status line and Check feedback inside the canvas, readouts and controls in the tray; presets `aria-disabled` with the visible reason "Check your answer first" while locked; "Show the answer" only after two failed checks. EventSpace keeps state with `useReducer(reducer, setup, initialState)` and sets Board's `announcement` from `announcementFor()`: immediately for Check, presets and Show the answer, debounced by `KEYBOARD_COMMIT_DELAY_MS` for toggles. Grid label: `Outcomes of ${scenario.describeSpace}. Rows: ${rowLabel}. Columns: ${colLabel}.`
- [ ] **Step 3: Add the CSS** with the spec's encodings table (A: `--ms-highlight` fill, 3 px solid `--ms-attention` inset border, "A" tag; B: 2 px dashed `--ms-board-ink` inset 5 px, "B" tag; outside the chosen set: muted ink, 1 px diagonal strike; missed: dotted 2 px ink outline), cells `min-inline-size: 44px` with a container query under 400 px narrowing the header column to 24 px and cells to `minmax(36px, 1fr)`, `gap: 6px`, forced-colors and print rules, and the 120 ms transition only under `prefers-reduced-motion: no-preference`.
- [ ] **Step 4: Create the lab page** `src/content/docs/lab/event-space.mdx` with `draft: true`, a 120–160 character description, and one board per setup built so far (`coins-build`, `dice-count`, `dice-operations`). Drafts are left out of production builds, so the lab never ships.
- [ ] **Step 5: Run `npm run check` and `npm run build`.** Expected: `0 errors`; every check passes; `dist/lab/` does not exist.
- [ ] **Step 6: Manual pass in the dev server** (`npm run dev`, open `/lab/event-space/` with the browser pane visible): the full checklist in the spec's Verification section, plus Review Focus 1 (five quick Space presses announce once, with the final count) and Review Focus 5 (temporarily set `setup="coins-bild"` and confirm the dev overlay names it, then revert).
- [ ] **Step 7: Commit** the files above with "Add the EventSpace board in count mode with Check, presets and keyboard grid".

### Task 4: Weights mode

**Files:**
- Create: `src/components/react/eventSpace/CupRow.tsx`
- Modify: `src/components/react/EventSpace.tsx`, `src/styles/components.css`, `src/content/docs/lab/event-space.mdx` (add `die-pour`)

**Interfaces:**
- Consumes: `pour`, `WEIGHT_TOTAL` (Task 1); `pour` and `weight-preset` actions and `refusalText` (Task 2).
- Produces: `export default function CupRow({ state, dispatch }: { state: EventSpaceState; dispatch: (action: Action) => void })`.

- [ ] **Step 1: Build `CupRow`:** a one-row table with headers "Cup 1"…"Cup 6"; each cell a column of 12 slots (filled: solid `--ms-board-ink`; empty: 1 px `--ms-board-axis` outline), the share as "2/12", and two native buttons "Pour one unit into cup N" / "Pour one unit out of cup N", refused ones `aria-disabled` with `aria-describedby` on the visible `refusalText`. The tray shows "Jug: k of 12 units left", the weight presets, the event presets, the additivity sum line, and the permanent note "The cups are drawn the same size. The water in them is the probability, not the cup."
- [ ] **Step 2: Run `npm run check` and `npm run build`.** Expected: `0 errors`; all checks pass.
- [ ] **Step 3: Manual pass on `die-pour`:** keyboard through all 12 buttons; refusals readable by screen reader; both themes; 320 px.
- [ ] **Step 4: Commit** with "Add the EventSpace weights mode for the probability axioms".

### Task 5: Decision record and docs (completes v1)

**Files:**
- Create: `docs/decisions/0011-eventspace-html-board.md`
- Modify: `docs/decisions/README.md`, `docs/design-system/components.md`, `docs/design-system/math-plots-code.md`, `docs/design-system/accessibility.md`, `src/components/react/Board.tsx` (JSDoc on `children` only)

- [ ] **Step 1: Write decision 0011** with the content listed in the spec's "Documentation and governance" section, including whether the A fill passed its contrast rules and the lab-page convention (`src/content/docs/lab/`, always `draft: true`).
- [ ] **Step 2: Update the docs:** EventSpace and TrayChoice in components.md; event-marking conventions in math-plots-code.md; the grid pattern in accessibility.md; Board's `children` JSDoc says "a Mafs canvas, or an HTML table for discrete content; HTML boards own their announcements and don't pass onInteractionEnd".
- [ ] **Step 3: Run `npm run build`.** Expected: all checks pass.
- [ ] **Step 4: Commit** with "Record EventSpace as the first HTML board and document its conventions".

### Task 6: Tosses and the wrong-model view (v1.1)

**Files:**
- Modify: `model.ts`, `state.ts`, `describe.ts`, `scenarios.ts`, `EventSpace.tsx`, `OutcomeGrid.tsx`, `components.css`, `scripts/check-boards.mjs`

**Interfaces:**
- Produces (model.ts): `simulate(all: readonly Outcome[], count: number, random: () => number): Record<OutcomeId, number>`; `poolTiles(tallies: Readonly<Record<OutcomeId, number>>, tiles: readonly WrongModelTile[]): { label: string; count: number }[]` with `interface WrongModelTile { label: string; members: OutcomeId[] }`.
- Produces (scenarios.ts): optional `wrongModel?: { tiles: WrongModelTile[]; caption: string }` on `two-coins` only: tiles `HH` [HH], `one of each` [HT, TH], `TT` [TT]; caption "If these 3 were equally likely, at least one head would be 2/3."
- Produces (state.ts): actions `{ type: 'toss' }` (adds 100) and `{ type: 'wrong-model'; on: boolean }`; both refused while `isLocked`.

- [ ] **Step 1: Append assertions:** `simulate` with a deterministic `random` (cycling 0, 0.25, 0.5, 0.75) over two coins and 100 tosses gives 25 per outcome; `poolTiles` on those tallies gives `[{HH,25},{one of each,50},{TT,25}]`; toss refused on a fresh `coins-build`; after a correct Check, two tosses give `tossCount` 200; the toss line reads "Tossed 200 times: at least one head 151 times (0.76). Your count says 0.75." for tallies totaling 151 of 200.
- [ ] **Step 2: Run the check.** Expected: fails on the missing exports.
- [ ] **Step 3: Implement**, with `Math.random` passed in by EventSpace (never called inside `model.ts`). Tallies show inside cells only on grids of 12 cells or fewer, otherwise in the readout. The wrong-model switch (`role="switch"`) regroups the 2×2 grid into three tiles with dashed ink strokes and the caption.
- [ ] **Step 4: Run the check, `npm run check` and `npm run build`.** Expected: all pass.
- [ ] **Step 5: Manual pass:** tosses announce "Tossed 200 times in all. At least one head 151 times, 0.76." style totals once per batch; the switch is operable by keyboard and named.
- [ ] **Step 6: Commit** with "Add tosses and the HT/TH wrong-model view to EventSpace".

### Task 7: Picture, letters and sets stages (v1.1)

**Files:**
- Modify: `state.ts`, `describe.ts`, `OutcomeGrid.tsx`, `EventSpace.tsx`, `components.css`, `scripts/check-boards.mjs`

**Interfaces:**
- Produces: action `{ type: 'stage'; stage: 'picture' | 'letters' | 'sets' }`; `setsLine(state): string | null`.

- [ ] **Step 1: Append assertions:** `setsLine` is `null` before Check on `coins-build` and after Check is "Ω = {HH, HT, TH, TT}. A = {HH, HT, TH}. P(A) = |A| / |Ω| = 3/4"; the `picture` stage is refused on `dice-count` (36 cells) and allowed on `coins-build`.
- [ ] **Step 2: Run the check.** Expected: fails.
- [ ] **Step 3: Implement** a `TrayChoice` "Show as: Pictures | Letters | Sets" on setups with `stages: true`; Pictures draws each coin as an ink circle containing "H" or "T" (CSS only); Sets adds `setsLine()` under the grid.
- [ ] **Step 4: Run the check, `npm run check` and `npm run build`.** Expected: all pass.
- [ ] **Step 5: Manual pass:** stage choice by keyboard; the sets line is read after Check; pictures fit 44 px cells at 375 px.
- [ ] **Step 6: Commit** with "Add picture, letters and sets views to EventSpace".

### Task 8: Final verification

- [ ] **Step 1: Run** `npm run check`, `npm run build`, `npm run check:code`. Expected: `0 errors`; every check passes; `dist/lab/` absent.
- [ ] **Step 2: Repeat the spec's full manual pass** on all four setups.
- [ ] **Step 3: Request a whole-branch review** of the EventSpace commits against the spec and this plan, and fix what it confirms.
