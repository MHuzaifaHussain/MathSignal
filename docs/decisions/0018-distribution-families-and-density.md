# 0018: DistributionBoard families and density mode

Status: accepted, 2026-11-25. Amends [0012](0012-distribution-board.md).

## Context
The binomial page needs a distribution with up to 11 values whose chances come from n and p, not from outcomes the reader maps by hand, and its first prediction ("6 heads in 10 flips: about 1 in 2, 1 in 5 or 1 in 50?") must be committed before the board shows anything about 10 coins. The probability density page needs a histogram that turns into a curve and a shaded stretch whose area is a chance. Decision 0012 planned a separate Mafs `DensityBoard` for the continuous case. The tile view caps at 7 columns, and its exact fractions overflow for a binomial with p = 0.3 at n = 10.

## Decision
1. **Three modes in one island.** `DistributionBoard` picks `OutcomeBoard` (the 0012 board, unchanged), `FamilyBoard` or `DensityBoard` from the `setup` id (`boardSetups.ts`, which throws on an unknown id or one two modes claim). Each mode has its own setups, reducer and describe module; they share `columnAxis.ts`, `ColumnChart.tsx`, `ValueTable.tsx`, `numberFormat.ts`, `chartMarks.tsx` and the guided pieces. The move left the four outcome setups' server-rendered markup identical (compared on the lab page with `useId` values normalized).
2. **The continuous mode is HTML.** This supersedes 0012's Mafs `DensityBoard`. Shapes are piecewise-linear densities with knots on a quarter-centimeter grid (`density.ts`), so every area, bin share, mean and variance is an exact fraction; Simpson's rule is exact for these segments. Later float shapes plug into the same `ContinuousShape` interface and read "≈" through `Exactness`. One mapping, `rulerPercent`, places bins, the curve, ticks, the shaded edges and the μ and σ marks, so the Bars and Curve views agree.
3. **NormalDistribution stays separate and untouched.**
4. **Plain columns at every n.**
   - A spacing rule replaces a column cap: a setup is valid while its columns are at least 14px wide at a 320px viewport. The column area (the chart less its 28px gridline gutter) measured 243px there, so `NARROWEST_CHART_PX` is 242 and up to 17 columns fit; this week uses 11 (binomial) and 16 (0.25 cm bins). Tiles keep their 7-column limit.
   - Each setup has a fixed scale, validated over every reachable state, with labeled gridlines: 0 to 1/2 for `coins-binomial`, 0 to 1 for `binomial-spread`, 0 to 2 per cm for `sand-pour` and 0 to 1/2 per cm for `sand-interval`. A scale that followed the bars would rescale between the two presets the binomial page compares.
   - Any nonzero chance draws at least a 2px stub, and reads "under 0.01" (or "under 0.0001" in four-place tables), never "≈ 0.00". The comparison is in BigInt, since 20¹⁰ × 20,000 passes 2⁵³.
   - At n ≤ 3 a read-only list of every coin sequence replaces tiles, so the axis never jumps.
   - Value labels sit under every column while each is at least 24px wide, and under every second one below that (a container query).
5. **A guess before ten coins.** `coins-binomial` covers its chart, readouts other than the status line, and its table for n ≥ 4 until a one-shot Check (`recordCheck`, mode `once`). Presets are refused until Check, even the one showing, and the read pair is refused while covered. The three verdicts start with "Yes" only for the right pick, and Check sets 10 coins, reads 6 heads and moves focus to the verdict.
6. **Exact binomials, closed-form moments.** `binomial(n, j)` reduces p = j/20 first, so a fair coin's weights are C(n, k) over 2ⁿ. μ = np and σ² = np(1 − p) come from the closed forms; the generic variance overflows at n = 10, p = 0.3. Fair-coin chances read as fractions ("210/1024 = 105/512 ≈ 0.21"), others as decimals. New modes write amounts with the shared `amountText` ("2.5", "19/400 ≈ 0.05"); the outcome mode keeps its shipped `amountChain`.
7. **Ghosts follow 0012.** A ghost is made only on a change from one named preset to another while the spread shows; slider moves keep it, and its "Now" side names the preset or "n = 10, p = 0.85". The family ghost stores the exact variance, so either side can read "= 0.5". A ghost equal to the preset showing is not drawn.
8. **Zero weights get no bar** (hardening): `distributionFromPmf` skips them and every outcome source needs weights of at least 1. Histogram bins are not bars.
9. **The push rule for intervals.** From and To keep a fixed 0 to 4 cm range; moving one past the other carries the other along, and the announcement says so. No key is dead and no slider maximum changes.
10. **Table view (0017)** folds every new table (`ValueTable`). The readouts carry every number each lesson needs: the read bar, the tallest bar, μ, σ, the shaded share and the tallest histogram bar.
11. **A shared slider guard.** `guided/sliderGuard.ts` (with `useCommittedSlider`) holds the stale-commit rule: a slider's late commit announces only if that slider was the last thing moved and still holds its value. The family, density and outcome (pencil) boards use it. VectorBoard2D and DescriptiveStats still carry their own copies and move onto it in their own commits.
12. **`groupThousands` lives in `boardText.ts`**, and DescriptiveStats re-exports it. The Bayes board still uses its own `Intl` formatter.
13. **`cardText` stays die-only.**

## Consequences
- Heights at 375px with the table folded, measured on the lab page on 2026-11-25. None meets the 480px guideline; every row holds a control or readout the pages' flows use:

  | Setup, state | Height | Board, tray |
  |---|---|---|
  | `coins-binomial`, opening (3 coins) | 1,158px | 562, 595 |
  | `coins-binomial`, after Check | 924px | 591, 332 |
  | `binomial-spread`, spread on with a ghost | 1,120px | 650, 469 |
  | `sand-pour`, Bars / Curve | 779 / 723px | |
  | `sand-interval`, opening / spread on | 833 / 1,017px | |

  The levers, if wanted later: a two-column tray at 560px and up (nothing at 375px), a two-thumb interval slider, or the guess as a select.
- The island grows from about 16.7 KB to 29.8 KB gzip (esbuild, minified, React and Base UI external), so every DistributionBoard page now ships about 13 KB of family and density code it may not use. That passes the 10 KB mark this design set for splitting the modes into lazy chunks; the split is owed before the binomial and density pages go live.
- Every folded table fits the tray at 320px (255px wide) with the table open: `coins-binomial` at 3 and 10 coins, `binomial-spread`, `sand-pour` at 0.25 cm and `sand-interval` with its footer.
- `mu` and `sigma` on `highlight` join `contrastRules` as graphics, because the μ guide and σ span cross the ochre read column and shaded stretch.
- On the 0 to 2 per cm scale Even sand's bars are short (1/8 of the plot), and on the 0 to 1 scale Fair coin's tallest bar is a quarter of it. That is honest: the scale is the lesson.
- Density sentences are provisional until the density page has had its review; `check-boards` asserts their numbers, the no-spoiler words and the tables, and pins them word for word after that review.
- `sand-pour`'s gridline is labeled "1" with "Height (per cm)" above the plot, because "1 per cm" doesn't fit the 28px gutter at 320px.
- "C(10, 6)", "√(13/18)" and "cm²" join the owed NVDA and VoiceOver pass.

## Alternatives considered
- A separate Mafs `DensityBoard` (0012's plan): about 31 KB gzip and a second keyboard model, with no reuse of the histogram columns.
- The continuous mode on FunctionCurve, which teaches a function and its slope, not probability readouts.
- Tiles for n ≤ 3 and columns above: every bar would jump at n = 4.
- One readout sentence per column: 11 to 16 sentences.
- Numeric integration, scales that follow the bars, a two-thumb slider, and a 0..n slider for the bar being read (its maximum would change with n).
