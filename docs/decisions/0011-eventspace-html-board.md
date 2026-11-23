# 0011: EventSpace, the first HTML board

Status: accepted, 2026-11-23

## Context
The first probability pages need a board where a reader sees every possible outcome and builds events from them, and that board must defeat the classic mistake of treating HT and TH as one outcome. Every board so far is a Mafs plot with draggable points and sliders. A sample space of discrete, equally likely outcomes is not a coordinate plane: it is a table. The design compared a table inside `Board`, an extension of the BayesTheorem area board, and building a generic Board API (goal, presets, prediction) first.

## Decision
- **EventSpace renders an HTML table inside `Board`**, not a Mafs canvas: native table semantics with one `aria-pressed` toggle button per outcome, a roving-tabindex grid, text that reflows at 375 px and 200% zoom, a server-rendered table that prints, and no Mafs in its bundle. `Board` itself is unchanged: its `children` may be a Mafs canvas or an HTML table, and an HTML board owns its announcements and never passes `onInteractionEnd` or `handleLabels`.
- **Presets, Check, the wrong-model view and modes stay inside EventSpace**, selected by a single `setup` string prop. There is no generic Board goal/preset/predict API yet; it is lifted into `Board` when a second board needs the same behavior. Goal sentences and predictions stay in the page's prose, as `writing-a-concept-page.md` requires; the board's part is to withhold the answer until Check passes.
- **"Show as table" is met by construction** for discrete boards: the board is the table, and its readout sentences are the description.
- **Event A uses the existing `--ms-highlight` fill** with a solid `--ms-attention` border and an "A" tag; event B a dashed ink outline and a "B" tag. Two contrast rules guard the fill (`boardInk` on `highlight` as text, `attention` on `highlight` as a graphic); both pass in both themes.
- **Conditioning is a named mode** (`condition`, added 2026-11-24 for the conditional probability page): a "Shrink the world to B" switch rules out the outcomes outside B and the readout gives P(A | B) beside P(A). It is refused while B is empty, because P(A | B) is then undefined, not 0. Fixed data such as a class of children uses a `list` layout with no row or column headers, and its cells can be focused and read but not toggled (`aria-disabled`, no `aria-pressed`).
- **Board configuration lives next to the component** (`src/components/react/eventSpace/scenarios.ts` and `setups.ts`), not in `src/data/`, because it is not a fact shared across pages.
- **All math, copy and state transitions are pure TypeScript** (`model.ts`, `describe.ts`, `state.ts`) checked by `scripts/check-boards.mjs` with `node:assert` before every build. Node 24 runs the modules directly, so no test framework is added.
- **Boards get a lab page.** `src/content/docs/lab/<board>.mdx` shows every setup during development and is always `draft: true`, so it is never built for production.

## Consequences
- The site has two kinds of board: Mafs plots for continuous math, HTML tables for discrete spaces. `components.md`, `math-plots-code.md` and `accessibility.md` document both.
- A typo in a page's `setup` fails the build with a message naming the id.
- Screen-reader behavior of buttons inside `role="grid"` needs a manual pass with NVDA and VoiceOver before launch; if a reader handles it badly, the fallback is a plain table of toggle buttons in normal tab order.

## Alternatives considered
- **Extend BayesTheorem's unit square (Mafs, areas).** Continuity with the Bayes page and unequal weights for free, but sliders hide the counting step page 1 teaches, Mafs gives no table semantics, and it adds about 31 KB gzip.
- **Build the generic Board API first.** Every later board would get guided features, but it is an abstraction guessed from one consumer, about 2.5 extra days before week 1, and decision 0008 defers these features to their own records.
