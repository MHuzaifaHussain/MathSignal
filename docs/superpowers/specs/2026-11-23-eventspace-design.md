# EventSpace board: design

Date: 2026-11-23. Status: draft for approval.

## Why

The first probability pages need a board where a beginner sees every possible outcome and builds events from them. The plan's seed for page 1 is "List every way two coins can land; shade the 'at least one head' squares." The most common beginner mistake it must defeat is treating HT and TH as the same outcome (which gives 2/3 instead of 3/4). The same board then carries the probability axioms, conditional probability, independence, and independent vs mutually exclusive events, so it must start simple and grow without a new API.

It is the first board for probability and the first board that is not a smooth plot. Week 1 can't start without it.

## Pages it serves (solo schedule)

| Page | Type | When | Board version |
|---|---|---|---|
| `probability/sample-spaces-and-events` | A | week 1 | v1, plus v1.1 before launch |
| `probability/probability-axioms` | B | week 1 | v1 |
| `probability/conditional-probability` | B | week 2 | v1.2 |
| `probability/independence` | B | after week 12 (or a stretch row) | v1.3 |
| `probability/independence-vs-mutual-exclusivity` | D | after week 12 | v1.3 |

The public launch at the end of week 2 includes pages 1–3.

## Goals

- A reader builds events by tapping outcomes and reads the probability as an exact count and fraction ("3 of 4 outcomes. P(A) = 3/4 = 0.75").
- On goal setups the board withholds the answer until the reader commits with **Check**, and Check names the specific mistake (HT without TH).
- One component, one `setup` prop, serving all five pages through named setups and modes.
- Fully usable by keyboard and screen reader, at 320 px, in both themes, in forced colors and in print.

## Non-goals

- No generic Board API (goal, predict, presets, describe/table props on `Board`). Goal and prediction live in the page's prose, as `writing-a-concept-page.md` requires; presets and Check live inside this board. Lift them into `Board` when a second board needs the same behavior.
- No continuous or uncountable spaces, no more than 36 outcomes, no third event.
- No drag-to-paint, no state export to PyRunner, no area-proportional layout (possible later).

## Anti-goals (it fails even if it works)

- The board shows P(A) or recognizes the named event before the reader presses Check on a goal setup.
- Meaning is carried by color alone, or pink/blue appear.
- The board suggests that the three-outcome model {HH, one of each, TT} is equally likely, that frequencies are probabilities, that overlapping events are independent, or that equal-size cups mean equal probability.

## Approaches considered

1. **HTML outcome table inside `Board`, one `setup` prop (chosen).** Discrete outcomes are a table: native table semantics and real buttons, reflowing text at 375 px and 200% zoom, a printable server-rendered table, forced-colors support, and no Mafs in the bundle. Two of three judges picked it; it scored highest overall.
2. **Extend BayesTheorem's unit square (Mafs, areas).** Visual continuity with the Bayes page and unequal weights for free, but sliders hide the counting step page 1 teaches, Mafs gives no table semantics, and it adds about 31 KB gzip.
3. **Build the generic Board API first** (plan amendment V3, about 2.5 days). Every later board would get guided features, but it is an abstraction guessed from one consumer, decision 0008 defers these features to their own records, and prose already covers goal and prediction at no cost.

The owner delegated the choice; the design below is approach 1 with the best ideas of the other two panel designs grafted in (answer withheld until Check, HT/TH-specific feedback, the reader's own tosses refuting the wrong model; refusing to condition on P(B) = 0, exact verdicts, a loaded-die preset, forced colors, print, a 320 px floor).

## What the reader does

### Page 1: sample spaces and events (setups `coins-build`, then `dice-count`)

Prose before the board: the prediction "Toss two coins. What is the chance of at least one head: 1/2, 2/3 or 3/4?", a second-depth prediction in a GoDeeper fold ("How many different ways can two coins land, and are they all equally likely?"), and the goal "Tap every square where at least one coin shows heads, then press Check."

1. The board opens on a 2×2 table: rows "First coin: H / T", columns "Second coin: H / T", cells HH, HT, TH, TT. Status: "4 equally likely outcomes. Event A: at least one head. Tap the squares that belong to A." No probability is shown.
2. Each tap toggles a cell's membership of A. The status shows only "You have marked 2 squares."
3. **Check** gives feedback that names the mistake:
   - correct: "Yes: HH, HT and TH. 3 of 4 squares, so P(A) = 3/4 = 0.75." The readout unlocks and stays live: "A = {HH, HT, TH}. 3 of 4 outcomes. P(A) = 3/4 = 0.75."
   - one of HT/TH missing: "Not yet. You have HT but not TH. First coin tails, second coin heads is a different way to land from first coin heads, second coin tails." The missing cell gets a dotted outline and the word "missed".
   - TT marked: "TT has no head; remove it."
   - otherwise: "You have k of the squares A needs, and j that don't belong."
   - after a second wrong Check, a **Show the answer** button appears.
4. Presets (at most 4 per event): "At least one head", "Exactly one head", "Both the same", "Clear". On a goal setup they stay disabled (focusable, with the visible reason "Check your answer first") until Check passes.
5. **v1.1, before launch:** **Toss 100** drops simulated tosses into the cells as tallies, with "Tossed 200 times: at least one head 151 times (0.76). Your count says 0.75." The switch **Treat HT and TH as the same outcome** regroups the grid into three tiles (HH, one of each, TT) with the caption "If these 3 were equally likely, at least one head would be 2/3", and re-pools the reader's own tallies so "one of each" visibly holds about half the tosses, not a third.
6. A second board further down (`dice-count`, 6×6, no goal, readout live) asks in prose "Is a sum of 7 as likely as a sum of 2?", with presets "Sum is 7" (6 of 36) and "Sum is 2" (1 of 36).

### Page 2: probability axioms (setups `dice-operations`, `die-pour`)

- **`dice-operations`** (two dice, A and B editable): "Editing: A | B" picks the event a tap changes; "Look at: everything | A and B | A or B | not A" mutes the cells outside the chosen set. Readouts: "not A: 30 of 36"; "A and B = {(6,1)}: 1 of 36"; "A or B: 6 + 6 − 1 = 11 of 36 = 0.31" (A = sum is 7, B = first die is 6), so the double-counted square explains the − 1.
- **`die-pour`** (weights mode, the jug seed): six cups, each a column of 12 slots with its share written as "2/12"; the tray shows how much is left, e.g. "Jug: 4 of 12 units left". Each cup has "Pour one unit into cup 3" and "Pour one unit out of cup 3".
  - Axiom 1: pouring out of an empty cup is refused with "A cup can't hold less than nothing."
  - Axiom 2 is breakable and said to be broken: with water left in the jug the readout says "8 of 12 units poured. The cups add up to 8/12, not 1, so this isn't a probability yet." When the jug is empty: "All 12 units poured: the cups add up to 1."
  - Axiom 3: event presets "Even", "At most 2", "Six", with the sum written out ("P(even) = 2/12 + 2/12 + 2/12 = 6/12 = 0.5").
  - Weight presets: "Fair die" (2 units in every cup), "Loaded toward six" (1, 1, 1, 1, 1, 7), "Start over" (every cup at 0, all 12 units back in the jug).
  - A permanent note: "The cups are drawn the same size. The water in them is the probability, not the cup."

### Page 3: conditional probability (v1.2; setups `dice-condition`, `kids-condition`)

- Two dice, A = "sum is at least 10" (6 outcomes), B = "doubles" (6). The switch **Shrink the world to B** mutes and strikes the cells outside B, labeled "ruled out". Readout: "Inside B: 6 outcomes, 2 of them also in A ((5,5) and (6,6)). P(A | B) = 2/6 = 1/3, while P(A) = 6/36 = 1/6."
- If B is empty the switch is refused: "Undefined: B can't happen (probability 0)."
- After tosses, "Keep only tosses where B happened" filters the tallies.
- Hats seed: 12 children in a 3×4 list layout, 5 with hats, 2 of them with scarves, 4 scarves in all: "P(scarf | hat) = 2/5 = 0.40, while P(scarf) = 4/12 = 1/3."
- The page's prose links this "shrink the world" move to the BayesTheorem board, which does the same with areas.

### Pages 4 and 5 (v1.3, after week 12)

Mode `compare` prints both sides of P(A and B) = P(A) × P(B) and of P(A | B) = P(A), decided by exact integer cross-multiplication, never float equality, with the verdict in words. Exclusivity ("A and B is empty") is computed on the sets and reported separately. Examples (all checked): heads and die even, 1/4 = 1/2 × 1/2; die even and die ≥ 4, 1/3 against 1/4; sum 7 and first die 6, 1/36 = 1/6 × 1/6; on a die, A = {1, 2} and B = even are independent when fair (1/6 = 1/3 × 1/2) and not when loaded toward six (1/12 against 1/8). The empty event is both exclusive and independent, and is reported that way.

### Opening state of each setup (builder's call, made here)

| Setup | Goal setup? | Opens with | Presets |
|---|---|---|---|
| `coins-build` | yes: A = at least one head | A empty | A: At least one head, Exactly one head, Both the same, Clear (locked until Check) |
| `dice-count` | no | A empty, readout live | A: Sum is 7, Sum is 2, Clear |
| `dice-operations` | no | A = sum is 7, B = first die is 6 (the page's worked example), editing A, "Look at: everything" | A: Sum is 7, A double, Clear. B: First die is 6, Second die is 6, Clear |
| `die-pour` | no | Fair die: 2 units in every cup, jug empty, so the axiom 2 line reads "the cups add up to 1" | Fair die, Loaded toward six, Start over |
| `dice-condition` (v1.2) | no | A = sum is at least 10, B = doubles, Shrink off | A: Sum at least 10, Clear. B: Doubles, Clear |
| `kids-condition` (v1.2) | no | A = scarf, B = hat, Shrink off | none (the data set is fixed) |

On goal setups, Toss (v1.1) is also locked until Check, so tallies can't give the answer away.

## Look

A `<table role="grid">` inside Board's canvas, with Board's tray underneath. Top to bottom in the canvas: status line, table, Check feedback. Readouts and controls sit in the tray.

```
375 px, two coins, before Check
+-- Board --------------------------+
| 4 equally likely outcomes.        |
| Event A: at least one head.       |
| Tap the squares that belong to A. |
|              Second coin          |
|               H         T         |
| First  H  [A  HH  ] [A  HT  ]     |
| coin   T  [   TH  ] [   TT  ]     |
| You have marked 2 squares.        |
+-- tray ---------------------------+
| [Check]                           |
| presets: disabled until Check     |
|                          [Reset]  |
+-----------------------------------+
```

Encodings use existing tokens only, and every cue is doubled by shape or text:

| State | Encoding |
|---|---|
| In A | `--ms-highlight` fill, 3 px solid `--ms-attention` border inside the cell edge, "A" tag top-left |
| In B | 2 px dashed `--ms-board-ink` outline inset 5 px, "B" tag top-right, no fill |
| In A and B | both of the above |
| Outside the chosen set ("Look at", "Shrink to B") | no fill, text in `--ms-board-ink-muted`, a 1 px diagonal strike, "ruled out" or "outside" in the accessible name; never opacity on text |
| Missed after Check | dotted 2 px ink outline and the word "missed" (dotted, so it can't be confused with B) |
| Wrong-model tiles (v1.1) | dashed ink strokes, full-contrast labels |
| Cup slots | filled: solid `--ms-board-ink`; empty: 1 px `--ms-board-axis` outline |
| Focus | the unchanged site focus ring, outside the cell; A always sits inside the edge |

- The A fill needs two new contrast rules in `palette.mjs`: `['boardInk', 'highlight', 'text']` and `['attention', 'highlight', 'graphic']`. If `check:design` rejects either, A drops the fill and keeps the border and tag, which are already enough on their own.
- Cells are equal squares, 44 px wide at a 375 px viewport and never under 36 px at 320 px (above the WCAG 2.2 AA minimum of 24 px), with a 6 px gap so the focus halo never paints onto a neighbor. Below a 400 px container width the row-header column narrows to 24 px. No sideways scroll at any width. Tallies show inside cells only on grids of 12 cells or fewer; on 6×6 they go in the readout.
- Forced colors: fills drop, A keeps a solid `CanvasText` border, B a dashed one, tags stay, focus uses `Highlight`. Print: tray buttons hide (existing rule), the table and readouts print. Reduced motion: the only transition (120 ms on background and border) runs only under `prefers-reduced-motion: no-preference`.
- No pink or blue, no shadows beyond the site focus halo, no left bars, no gradients (decision 0006). Plain Unicode for "P(A | B)"; no KaTeX in the island (decision 0007).

## Interaction

- **Grid:** APG data-grid pattern on a native table. `<table role="grid" aria-multiselectable="true">` with `<th scope>` headers; each cell holds a `<button aria-pressed>` meaning "in the event being edited". Accessible names put membership in words, last: "HT. First coin heads, second coin tails. In A." One tab stop with a roving tabindex. Arrows move (no wrap), Home/End to row ends, Ctrl+Home/End to the first and last cell, Space/Enter toggle. No single-letter shortcuts. One tap toggles; the canvas keeps `touch-action: pan-y`.
- **Weights mode:** a one-row table, "Cup 1" to "Cup 6", each cell with two native buttons. Refusals use `aria-disabled` (still focusable) with `aria-describedby` pointing at the visible reason. Names carry state: "Cup 3: 2 of 12 units."
- **Tray:** native controls, 44 px tall. A new shared `TrayChoice` (fieldset, legend, native radios styled as segmented buttons) for "Editing", "Look at" and "Shrink to B". Presets, Check, Show the answer and Toss use `.ms-board-button`; the wrong-model view and Shrink to B are switches. Reset uses Board's `onReset` and re-locks goal setups.
- **Announcements:** Board's polite `announcement`, set only when an interaction ends, from the same `describeState()` that writes the visible text, so speech and screen agree. Cell toggles are debounced 600 ms ("You have marked 3 squares"; after Check, "A: 3 of 4 outcomes, P of A = 3/4"). Check announces at once. EventSpace does **not** pass `onInteractionEnd` (Board's keyup hook would fire on every arrow key) and passes no `handleLabels`.

## Probability model

- Finite space, at most 36 outcomes, each with a stable id. Product spaces are ordered pairs: HT and TH are different cells, and headers say "first" and "second".
- An event is any subset, including the empty set and the whole space; that is legitimate because the space is finite (page 1's GoDeeper fold says so and links non-measurable sets).
- Labels say "outcome" for a cell and "event" for a set.
- **Count mode:** equally likely outcomes only, and the status line always says "N equally likely outcomes". P(E) = |E| / |Ω|, shown as the unreduced count, then the reduced fraction, then a 2-place decimal (with "≈" when rounded).
- **Weights mode:** non-negative integer units out of 12, so halves, thirds, quarters and sixths stay exact; zero is allowed. Called a probability only when the jug is empty.
- **Conditional:** P(A | B) = |A and B| / |B| (or unit sums); refused when P(B) = 0.
- **Simulation:** unseeded `Math.random`, batches of 100, cumulative share always shown beside the exact value.

## Component

One serializable prop, because island props from MDX can't carry functions:

```mdx
<div class="not-content"><EventSpace client:visible setup="coins-build" /></div>
```

- `setup` is a TypeScript union of setup ids. An unknown id, more than 4 presets per event, or a preset from another scenario throws during server rendering, so the build fails loudly.
- Files:
  - `src/components/react/EventSpace.tsx`: composes Board, grid and tray.
  - `src/components/react/eventSpace/OutcomeGrid.tsx`, `CupRow.tsx`, `useRovingGrid.ts`.
  - `src/components/react/eventSpace/model.ts`: pure, no React. Fractions reduced by gcd, probability, and/or/not, `checkGoal()` returning a typed result (`correct`, `missed-mirror`, `extra`, `partial`), `describeState()`, exact independence.
  - `src/components/react/eventSpace/scenarios.ts` and `setups.ts`: data. They live next to the component, not in `src/data/`, because they are board configuration, not facts shared across pages.
  - `src/components/react/TrayChoice.tsx` (shared; BayesTheorem's scenario presets are its second user).
  - `src/components/react/boardTiming.ts`: the 600 ms commit delay, moved out of `TraySlider.tsx` so both share it.
  - CSS: `.ms-event-*` and `.ms-choice` in `src/styles/components.css`.
- `Board` gets no code change in any version. Its JSDoc and `components.md` say `children` may be a Mafs canvas or an HTML table for discrete content, and that HTML boards own their announcements and don't pass `onInteractionEnd`.
- Scenarios in v1: two coins (2×2), one die (1×6), coin and die (2×6), two dice (6×6).

## Versions and budget

| Version | Days | When | Contents |
|---|---|---|---|
| v1 | 2 | before week 1 | Count mode (A and B editing, Look at, presets, goal and Check with HT/TH feedback, missed outline, Show the answer), readouts for A, B, not A, A and B, A or B; weights mode; setups `coins-build`, `dice-count`, `dice-operations`, `die-pour`; TrayChoice; both themes, 320/375 px, forced colors, print, reduced motion; decision record and docs |
| v1.1 | 1 | week 1, before launch | Toss 100 with tallies; the "Treat HT and TH as the same" view; the Pictures / Letters / Sets stage choice |
| v1.2 | 0.5 | week 2, before page 3 | Mode `condition`; list layout; setups `dice-condition`, `kids-condition` |
| v1.3 | 0.5 | before page 4 (after week 12) | Mode `compare`; weights on product spaces; setups `coin-die-independence`, `dice-exclusive-vs-independent` |

Cut order if v1 overruns: weights mode moves to week 1 Monday (page 2 is drafted later in the week), then "Look at", then `dice-count`. Never cut: Check and answer locking, keyboard and screen-reader support, readouts, the decision record.

**Stages (in scope before launch, built inside EventSpace):** page 1 is type A and needs concrete → pictorial → symbolic stages by launch. The solo plan defers a generic Board `stages[]` API, so EventSpace carries its own stage choice, shaped so it can be lifted into Board later:

- A `TrayChoice` "Show as: Pictures | Letters | Sets" on setups that opt in (page 1 only in v1.1).
- **Pictures:** coin faces drawn in ink (an "H" or "T" inside a circle, CSS only, no images), offered only on grids of 12 cells or fewer, so the 6×6 dice grid never has to fit pips into 36 px.
- **Letters:** the default view described above.
- **Sets:** the letters view plus a line under the grid in plain Unicode: "Ω = {HH, HT, TH, TT}. A = {HH, HT, TH}. P(A) = |A| / |Ω| = 3/4". On goal setups it appears only after Check passes, so the symbolic form still comes last.
- `OutcomeGrid` takes a `stage` value from v1 (only "letters" is used), so v1.1 adds views without reshaping it. Budget: +0.25 day in v1.1, making v1.1 one day.

## Documentation and governance (inside v1)

- A decision record, `docs/decisions/0011-eventspace-html-board.md`: the first non-Mafs board (an HTML table inside Board); presets, Check, wrong model and modes are local and selected by setup id; goal and prediction stay in prose; "the board is the table and the readout is the description" covers "Show as table" for discrete boards; `--ms-highlight` as the A fill with its contrast rules.
- `components.md`: EventSpace and TrayChoice; Board children may be HTML.
- `math-plots-code.md`: event-marking conventions (A: highlighter, solid ochre, tag; B: dashed ink, tag).
- `accessibility.md`: the grid pattern (roving tabindex, `aria-pressed` buttons, debounced count-only announcements, 6 px focus gap, 36 px floor at 320 px).
- `palette.mjs`: the two contrast rules, then `npm run tokens` and `npm run check:design`.

## Verification

There is no JavaScript test runner (none may be added without a decision). `model.ts` is pure so it can be unit-tested once one exists. Until then:

- `npm run check`, `npm run build` (all checks) and GitHub Actions green.
- Every worked number above recomputed by hand or in Python before it appears on a page.
- A manual pass: keyboard only; NVDA with Firefox and Chrome, VoiceOver on macOS Safari and iOS; 320, 375 and 1280 px; 200% zoom; both themes; forced colors; print preview; reduced motion.

## Risks

1. **Two-day overrun:** the fixed cut order above. v1.1 must land before launch; if it slips, page 1 waits rather than launching without the HT/TH refutation.
2. **Highlight fill rejected:** fall back to border and tag only.
3. **Focus vs A in the same color family:** A inside the cell edge, focus outside, 6 px gap; check a focused A-and-B cell in both themes at 320 px.
4. **Screen readers and buttons inside `role="grid"`:** if a reader fails badly in the manual pass, drop `role="grid"` and keep a native table of `aria-pressed` buttons in normal tab order.
5. **Equal squares hardening into "probability = count":** the status line always says "equally likely", page 1 flags fair coins, and page 2's weights mode breaks the uniform assumption the same week.
6. **Prop sprawl across five pages:** one `setup` prop; new behavior needs a named mode, never ad-hoc booleans.

## Calls made without the owner (check these)

- Approach 1 over the area board and the generic Board API.
- The A fill uses the existing `--ms-highlight` token with two new contrast rules (fallback: no fill).
- Goal and two-depth prediction live in prose; the board's job is to withhold the answer until Check.
- Pages 4 and 5 (v1.3) wait until after week 12, following the solo schedule.
- Simulation is unseeded, because it is for the reader, not for asserted numbers.
- Stages are built inside EventSpace (not as a Board API) and the picture view is limited to grids of 12 cells or fewer.
- The opening state and presets of each setup, in the table above.
