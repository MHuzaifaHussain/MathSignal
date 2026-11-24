# 0012: DistributionBoard, the second HTML board

Status: accepted, 2026-11-24

## Context
The week-3 probability pages (random variables and distributions, then expectation and variance) need a board for three ideas beginners often get wrong: a random variable is a function that gives every outcome one number, and outcomes that share a number have their chances added; the mean is the balance point of the bar chart, not its tallest bar or the middle of its range; and variance is spread around the mean, not the number of different amounts. About twenty later pages, starting with the binomial and density pages in week 5, need the same board. The design compared one general model with swappable views, an exact-rational board with its own range slider, and extending EventSpace.

## Decision
- **DistributionBoard is the second HTML board.** Like EventSpace (decision 0011) it renders HTML inside the unchanged `Board`, owns its announcements, and never passes `onInteractionEnd` or `handleLabels`. Discrete pages never load Mafs.
- **A two-layer pure model.** Layer 1 turns outcomes and a mapping of outcomes to values into a distribution: outcomes that share a value merge into one bar, and their integer weights add. Layer 2 turns a distribution into summaries (mean, variance, standard deviation, the balance verdict). Later pages with no outcome list, such as the binomial, enter at layer 2 with a probability mass function.
- **Setups are configured next to the component** (`src/components/react/distributionBoard/setups.ts`), selected by one `setup` string prop, and validated while the page renders, so a bad setup fails the build. The two outcome lists it borrows (one die, two coins) are imported from the EventSpace scenarios in a single file, so faces and HT/TH are still defined once.
- **The reader's pencil is ochre, never pink.** It is a guess, and pink would claim it is the mean μ. Pink appears only on the revealed μ and blue only on σ, so the random-variable page, which comes before μ and σ are taught, uses neither. Every pair already has a contrast rule in `palette.mjs`; there are no new tokens.
- **The plank stays level until "Balance it".** While the reader moves the pencil it does not tip, so the mean can't be found by watching the plank. After "Balance it" the plank tilts a fixed angle toward the heavy side, and a sentence always states the direction. The verdict is exact: the sign of an integer expression, not a tolerance.
- **On goal setups the chart starts covered.** The reader sets a value for each outcome, commits to an answer in prose, and passes Check; only then are the chart, the fractions and the table shown. After that the bars merge live as values change. Before Check, no string on the board states a probability, bar count or grouping computed from the reader's values.
- **Fraction and wording helpers are shared.** `fraction`, `formatFraction` and `greatestCommonDivisor` live in `src/components/react/boardMath.ts`, which also gains `add`, `multiply` and `compare`; every intermediate passes a safe-integer check that throws. The wording helpers (`plural`, `joinWords`, `capitalize` and the rounding helpers) live in `boardText.ts`. EventSpace and `check-boards.mjs` import them directly. The live-announcement helper is copied into DistributionBoard for now and shared after a screen-reader pass of both boards.
- **Stages, locks, Check and Show the answer stay board-local.** DistributionBoard copies EventSpace's shapes (a stage union, a lock with a visible reason, a limit on wrong Checks before the answer is offered). Decision 0011 kept presets, Check, the wrong-model view and modes inside EventSpace and said they would be lifted into `Board` when a second board needs the same behavior. That trigger is now met; the lift is deferred to the third board, when there are three consumers to design it from.
- **The continuous mode is proposed as a separate `DensityBoard.tsx`** for week 4, a Mafs entry that shares the summary functions and wording through a continuous distribution.
- **`NormalDistribution` is left untouched.** Whether the continuous mode replaces it or only shares its summaries is a week-4 choice with its own record.
- **All math, copy and state transitions are pure TypeScript** checked by `scripts/check-boards.mjs`, as for EventSpace. The board has a draft lab page showing every setup.

## Consequences
- The site has three kinds of board: Mafs plots, EventSpace tables and DistributionBoard bar charts with steppers. `components.md`, `math-plots-code.md` and `accessibility.md` document the new one.
- Stage and lock code now exists in two boards. A third board must lift it into `Board` first, rather than copy it again. (Superseded: the shared pieces became composable modules instead of `Board` props, see [0013](0013-shared-board-modules.md).)
- Exact fractions hold only while every intermediate stays a safe integer. A page that outgrows that, such as a binomial with a large `n`, switches its readouts to "≈" decimals by design, and the guard throws if a setup reaches the limit by mistake.
- The covered chart and the level plank make the board harder to explore casually. That is intended: the lesson is the reader's prediction, and the answer waits for it.
- Buttons in normal tab order, not `role="grid"`, carry the steppers, which avoids the open screen-reader question recorded in 0011. A manual pass with NVDA and VoiceOver is still needed before the week-3 pages ship.

## Alternatives considered
- **One general distribution model with swappable views.** Cleanest path for later pages, but speculative work now, it leaves a server-render question open, and it puts mean and spread on one board. Its same-mean presets and live pencil readout were taken.
- **An exact-rational board with a native range slider.** The most honest predictions, but about three days, and a native range slider breaks the tray slider convention. Its integer pencil, covered chart and separate density board were taken.
- **Extend EventSpace.** Its model is built on sets of outcomes, not on values assigned to outcomes.
- **Mafs for the discrete mode.** About 31 KB gzip more, prints and reflows worse, and loses table semantics (decision 0011).
