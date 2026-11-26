# Math, plots and code

The same three meaning colors run through formulas, plots and code. This file explains how to keep them consistent.

## Formulas (KaTeX)

Formulas are rendered at build time by `remark-math` and `rehype-katex` through Astro's `unified()` Markdown processor. No math JavaScript ships to the browser, and KaTeX's hidden MathML stays in place for screen readers.

### Colored variables

Use the macros, never `\color{}`:

| Write | Renders as |
|---|---|
| `\vmu` | μ in the μ color |
| `\vsigma` | σ in the σ color |

```mdx
$$
f(x) = \frac{1}{\vsigma\sqrt{2\pi}} \, e^{-\frac{(x-\vmu)^2}{2\vsigma^2}}
$$
```

The macros expand to `\htmlClass{ms-mu}{\mu}` and `\htmlClass{ms-sigma}{\sigma}`. KaTeX's `trust` option allows only `\htmlClass`, so `\href`, `\url` and the other trusted commands stay disabled.

A broken formula fails the build. rehype-katex on its own only logs a warning and ships red error text, so `rehypeKatexFailOnError` (in `src/design/katex.mjs`) turns those warnings into a build error that names the formula.

Color a variable only where the page is teaching it. In a long derivation, color the first and the key occurrences, not every one.

### Independence and perpendicular

Write independence with the `\indep` macro, which renders ⫫: `A \indep B`, or `A \indep B \mid C` for conditional independence. A single `\perp` (⊥) means perpendicular vectors only, as in `\mathbf{a} \perp \mathbf{b}`. Some books use ⊥ for independence; this site doesn't.

### Variables in prose

Use the `Var` component, so prose matches the formulas:

```mdx
import Var from '../../../components/Var.astro';

The mean <Var name="mu" /> sets where the bell sits.
```

## Plots (Mafs boards)

Every interactive plot sits inside a `Board` (see [components.md](components.md)). The board sets Mafs' CSS variables from the tokens, so Mafs components need no color logic.

In Mafs code, import colors from `src/components/react/plotColors.ts`:

```tsx
import { plotColors } from './plotColors';

<Plot.OfX y={pdf} color={plotColors.mu} />
<MovablePoint point={sigmaHandle} color={plotColors.sigma} />
```

| Constant | Meaning |
|---|---|
| `plotColors.mu` | Anything that is μ: the curve driven by μ, the μ handle, the μ guide line |
| `plotColors.sigma` | Anything that is σ: the σ handle, the σ span |
| `plotColors.attention` | The handle being dragged or focused, highlighted regions |
| `plotColors.ink` | Neutral strokes and labels on the board |
| `plotColors.inkMuted` | Secondary labels on the board |
| `plotColors.axis` | Secondary guides |

Never use `Theme.blue` or other Mafs defaults for meaning: they are not the design system's colors.

Never use Mafs `<LaTeX>` in a board. KaTeX is kept out of island bundles ([decision 0007](../decisions/0007-no-katex-in-islands.md)); use `<Text>` for labels and put formulas in the page's MDX.

### Known Mafs issue: `vec.lerp` and identical points

Mafs 0.21's `vec.lerp` (and `vec.midpoint`) return `[NaN, NaN]` when both points are the same ([mafs#188](https://github.com/stevenpetryk/mafs/pull/188), not merged). Current boards can't hit it: `Plot.OfX` and `Plot.Inequality` only interpolate between samples with different x values, and no project code calls `vec.lerp`. If a board starts using `Plot.Parametric` with a curve that can stand still, or calls `vec.lerp`/`vec.midpoint` directly, write the interpolation by hand (`[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]`) rather than patching Mafs.

### Board behavior

- Drags start only on a handle's hitbox (Mafs draws it at a fixed 30px radius). The board sets `touch-action: pan-y` on the plot so touch scrolling still works on empty space; handles keep Mafs' own `touch-action: none`, so touching a handle drags it.
- Every handle has a keyboard path. Either the tray has a slider for it (with `aria-valuetext` in words) and the handle is hidden from the tab order, or the board passes `handleLabels` so the handle itself is focusable, named and moved with the arrow keys (used by `LinearRegression`, which has nine points).
- A live region announces the new values when a drag, an arrow-key move or a slider change ends, never on every frame.
- Handwritten notes (`ChalkNote`) sit at the board's top-left, or its lower-left where the top-left holds labels (beside the grid, in normal flow, on an HTML board) and switch to their `short` text when the board is under 560px wide.

### z-scores (NormalDistribution `mode="z"`)

The curve is the standard normal on a fixed z-unit view, so presets relabel the rulers and never change its shape ([decision 0019](../decisions/0019-normal-distribution-z-mode.md)):

| Marking | Meaning |
|---|---|
| Ink curve, 2.5px, no fill | The standard normal φ; it isn't driven by μ here |
| Pink dashed guide to the peak, "μ" above it | The mean |
| Blue solid span at the inflection height, "σ" beside its right end | One standard deviation |
| Ochre 3px line and handle | The value: the board's one ochre element |
| Ink fill at 0.2 | The share below the value, only while "Shade the share below" is on |
| Ink row under the axis, captioned "cm" | The ruler in the group's units |
| Muted ink row under it, captioned "z" | The z ruler, only after Check |

The μ and σ labels sit where no marker can reach (checked over every state), and the drawing holds no z until the reader commits: on a fixed z view the marker's position is the answer.

### Vectors (VectorBoard2D)

Several vectors share one plane ([decision 0014](../decisions/0014-vector-board.md)). They are told apart by label and line style, never by hue:

| Marking | Meaning |
|---|---|
| Ink solid 2.5px arrow, label "a" | Vector a, or the push |
| Ink dashed 2.5px arrow, label "b" (or "û, length 1") | Vector b, or the track direction; on the add setup, b drawn from a's tip |
| Muted ink dashed arrows | The other route, b then a ("Show b first too") |
| Muted dotted lines | Component legs of the table row the reader points at, the length-5 circle, "into the rails" |
| Muted arc labeled θ, or a muted square corner | The angle between a and b, or a right angle |
| Ochre, 3px | The one element being taught: the guess ring, then a + b; c a; the shadow after Check; the flag ring on `span-reach`; the span line, or a ring at the origin, after Check on `span-shape` |
| Ink ring labeled "zero vector" | A zero vector, never an arrowhead; "a and b: zero vectors" when both are |
| Muted 1.5px arrows "a" (solid) and "b" (dashed) | On `span-reach`, the vectors the ink arrows "c a" and "d b" scale |
| Ink line with no head, ending at the edge | An arrow cut where it leaves the board; a head there would claim the vector ends at the edge |
| Small ink dot, no label | c a + d b on `span-reach`, whenever it is on the board |
| Muted dotted line edge to edge, labeled "span" | The span on `span-reach` after Check, when a and b line up |

Pink and blue never appear on this board: a vector is not μ or σ. Ochre marks exactly one element at a time (`ochreElement` in `describe.ts`); the handles are ink dots, and Mafs' focus ring is the site's focus color beside it. Board strings follow the notation registry in plain Unicode: ‖a‖ for a vector's length, |c| only for a number, "a · b" for the dot product and "c a" or "2 × a" for a multiple, never "c·a". A negative factor gets parentheses ("4 × (−1)"), lengths are exact or "√13 ≈ 3.61", and angles are "exactly 45°" or "about 94.4°". The plane stays square at Mafs' default aspect ratio; don't copy `preserveAspectRatio={false}` from the Normal board to a vector board.

### Function curves (FunctionCurve)

A curve, a ruler and the slope at a point ([decision 0020](../decisions/0020-function-curve-board.md)):

| Marking | Meaning |
|---|---|
| Ink solid 2.5px, one plot per piece | The curve; a corner stays sharp. In Slide, the slide, with the ground muted left of 0 |
| Dashed 2.5px with an ink end dot | The ruler (the pencil in Slide); ochre while no tangent is drawn, ink once it is |
| Muted dotted legs, "run 0.5" and "rise 1.25" | Rise over run; labeled only when \|h\| is at least 0.5 |
| Ochre solid 3px, labeled "tangent" | The tangent at the point, in Tangent and Slope curve |
| Ochre solid 3px through (0, 0), labeled "slope 0.5 line" | A line under the corner, while its switch is on; the tangent is not drawn then |
| Ink dot labeled "you" or "(1, 1)" | The point |
| Ink curve in the strip, open dots at a jump | The slope curve; no value is drawn at a corner |

Ochre marks exactly one element (`ochreElement` and `planeMarks` in `marks.ts`); pink and blue never appear. Numbers are exact decimals, never "≈". Where steepness is judged (x², ReLU, |x|) the view has equal scales; x³ and Loss declare unequal scales with numbered axes and use `preserveAspectRatio={false}`, so the drawing matches the edge test.

## Discrete boards (EventSpace)

Discrete sample spaces are HTML tables, not Mafs plots (decision 0011). They follow the same color rules with these conventions:

| Marking | Meaning |
|---|---|
| `--ms-highlight` fill, 3px solid `--ms-attention` border, "A" tag | In event A, the event of interest |
| 2px dashed `--ms-board-ink` outline inset 3px, "B" tag | In event B, the world you condition on |
| Muted ink text and a thin diagonal strike | Outside the set "Look at" focuses on, or ruled out by "Shrink the world to B" (never opacity on text) |
| Dotted ink outline and the word "missed" | An outcome the reader left out, after Check |

Pink and blue never appear: an event is not μ or σ. Tags and words double every marking, so nothing depends on color. Probabilities are shown as an unreduced count, then the reduced fraction, then two decimals ("3 of 4 outcomes. P(A) = 3/4 = 0.75"), in plain Unicode, never KaTeX.

Compare mode follows these wording rules:

- The verdict is words alone: "Independent: yes." or "Independent: no.", never green and red, an icon, or pink and blue. An event of probability 0 gets "Independent: yes, but only because B can't happen." (or A, or neither).
- Exclusivity is its own line, decided from the sets: "Mutually exclusive: no, A and B share 3 outcomes, {H2, H4, H6}."
- The product line prints decimals only when the two sides differ, so the reader sees by how much: "P(A and B) = 1/12 (≈ 0.08), but P(A) × P(B) = 1/12 × 1/2 = 1/24 (≈ 0.04): not equal." An equal line has none: "P(A and B) = 1/4, and P(A) × P(B) = 1/2 × 1/2 = 1/4: equal." Whole numbers never get decimals. The conditional line follows the same rule.
- A weighted face's note ("2/12") is board ink, like every other number. It writes units out of the jug the way the die-pour board does; cell names say "2 of 12 units".

### Discrete distributions (DistributionBoard)

DistributionBoard draws a random variable as stacked tiles, one tile per outcome, in columns by value ([decision 0012](../decisions/0012-distribution-board.md)). It is HTML like EventSpace and follows the same color rules with these conventions:

| Marking | Meaning |
|---|---|
| Ink tiles, ink plank, ink axis | The outcomes, grouped by the number each one gets. Bars carry no color of their own |
| Ochre wedge under the axis, labeled "your pencil" | The reader's guess for the mean. Ochre because it is "look here", never pink: a guess is not μ |
| `--ms-attention` border and `--ms-highlight` fill on a tile and its stepper row | The outcome the reader is pointing at, from stepper focus or hover |
| Pink triangle labeled "μ = …" and a dashed pink guide to the axis | The mean, drawn only once it is shown (after "Balance it", or from the start on a spread setup) |
| Blue span labeled "σ = …", with dotted ink arms labeled "1 away" | The standard deviation and each bar's distance from μ, only while "Show the spread" is on |
| Dashed ink span labeled "Before: σ …" | The previous preset's σ, for comparison |

Pink and blue appear only on the setups that are teaching μ and σ. `candy-build` and `coins-heads` use neither, because they come before μ and σ are taught. Every marking has a label or a word beside it, and the plank's tilt is always stated in a sentence ("The plank tips down on the right"). Tilt is a fixed 6 degrees toward the heavy side; the pencil never tips the plank until "Balance it". Tiles are die pips or coin faces in the Pictures view and the outcome's label otherwise, and the chart itself is `aria-hidden`.

Number format, one rule per kind of number (all in `describe.ts`, plain Unicode, never KaTeX):

| Kind | Format | Example |
|---|---|---|
| A chance in a readout or the table | Count, reduced fraction, two decimals | "3/6 = 1/2 = 0.50" |
| A chance in a Check or goal sentence | Count and reduced fraction; the decimal only when nothing reduces | "3/6 = 1/2", "1/6 ≈ 0.17" |
| An amount computed from the bars (μ, variance, σ, distances) | Reduced fraction, then the decimal with trailing zeros dropped | "μ = 7/2 = 3.5 candies", "σ = 2 candies" |
| The pencil, and anything measured from it | Two decimals, the same as the slider's readout | "your pencil at 3.50", "1 − 1.50 = −0.50" |

"≈" appears only when the decimal is rounded. A whole number has no fraction chain ("6/6 = 1").

**Family and density modes** ([decision 0018](../decisions/0018-distribution-families-and-density.md)) draw plain ink columns instead of tiles, on a fixed scale per setup with gridlines labeled in a gutter (dotted; a solid one where a setup asks). A scale never follows the bars, so two presets compare on one scale. The one ochre element is the read column (`--ms-highlight` fill, `--ms-attention` border) or, on `sand-interval`, the shaded stretch with ochre edges. Pink μ and blue σ appear only on `binomial-spread` and on `sand-interval` after its switch; `coins-binomial` and `sand-pour` use neither. Any nonzero chance draws at least a 2px stub. The density curve is an inline SVG stretched over the column area, so it holds no text; every label is HTML. Bins, curve, ticks, shaded edges and marks share one mapping along the ruler.

| Kind | Format | Example |
|---|---|---|
| A fair-coin chance | Count, reduced fraction, two decimals | "210/1024 = 105/512 ≈ 0.21" |
| Any other binomial chance | Two decimals in sentences, four in the table | "≈ 0.39", "0.3874" |
| A nonzero chance too small to show | "under 0.01", or "under 0.0001" in four-place tables; never "≈ 0.00" | "1/1024, under 0.01" |
| An amount (μ, variance, p) | `amountText`: whole, else up to 3 decimals, else the fraction and two decimals | "2.5", "19/400 ≈ 0.05" |
| σ | "√" and the variance as `amountText` writes it, parenthesized when a fraction | "√2.5 ≈ 1.58", "√(9/16) = 0.75" |
| Sand shares and heights | Fractions; positions and widths in cm | "7/32 of the sand", "7/16 per cm", "0.25 cm" |
| Counts and powers | Grouped counts, never grouped fractions; superscript powers, spoken "to the power" | "1,024 sequences", "1024/1024", "2¹⁰" |

### Data summaries (DescriptiveStats)

DescriptiveStats draws a short list of numbers as dots on a value-positioned axis ([decision 0015](../decisions/0015-descriptive-stats-board.md)). It is HTML like EventSpace and DistributionBoard and follows the same color rules with these conventions:

| Marking | Meaning |
|---|---|
| Ink dots, stacked when values tie or sit closer than a dot | The values. Dots carry no color of their own |
| `--ms-highlight` fill in an `--ms-attention` ring | Look here: the reader's pick, the child being moved, or Ana's marks. Never text |
| Pink triangle labeled "mean …" or "μ = …", with a dashed pink guide | The mean, only once it is shown (after Check on `class-lineup`) |
| Ink diamond and the word "median" | The median, an order statistic, so ink |
| Blue capped span labeled "σ = …"; a blue double line labeled "s …" | σ (÷ n) and, beside it, the sample s (÷ n − 1) |
| Dashed ink span labeled "Before: σ …" | The previous preset's σ |
| 2px ink box, 1px muted whiskers, dashed ink fences | The box plot: Q1 to Q3, the median line, Tukey fences at 1.5 × IQR |
| Solid ink ring with "IQR"; dashed ink ring with "z" | Flagged by the IQR rule; flagged by the z-score rule |
| Pink "mean" stub at 0, blue "σ" stubs at ±1 | The z-score row's reference marks |
| An arrow with its number at the right edge ("1,000 →") | A value past the axis, in the off-chart lane |

Definitions are the same on every statistics page: NumPy's linear quantiles, σ dividing by n (np.std) and s by n − 1 (pandas' .std()), "no mode" when two or more different values all appear equally often (a list whose values are all the same has that value as its mode), and a strict test against the fences. Pages say where readers' tools differ.

Number format (all in `describe.ts`, plain Unicode, never KaTeX):

| Kind | Format | Example |
|---|---|---|
| Whole numbers of 1,000 or more | Grouped with commas | "1,206 / 9 = 134 cm" |
| An exact amount | Trailing zeros dropped | "103.6", "4.5" |
| A rounded amount | "≈" and two decimals | "σ ≈ 7.68 kg" |
| A square root | Exact when the variance is a square, otherwise rounded | "√64 = 8 cm", "√72 ≈ 8.49 cm" |
| A min–max score | Unreduced, reduced, decimal | "15/18 = 5/6 ≈ 0.83" |

## Code (Expressive Code)

Code uses the **tuned full** palette: familiar editor-style highlighting with every color chosen so it can't be mistaken for μ, σ or "look here", even with color blindness.

| Token role | Light | Dark | Style |
|---|---|---|---|
| Keywords, built-ins, f-string braces, decorators | `#461f62` | `#b182ff` | Regular; decorators italic |
| Strings | `#0d4a22` | `#81a567` | Regular |
| Numbers, `True`, `None`, CONSTANTS | `#6c1f03` | `#f6781e` | Regular |
| Comments and docstrings | `#464236` | `#ac9879` | Italic |
| Names, calls, operators, parameters | `#1e2725` | `#f2f0ea` | Regular |
| Background | `#f6f8f7` | `#1f2423` | |
| Line numbers | `#5f6d69` | `#8b9692` | |
| Highlighted lines (`{4-5}` in a fence) | Band `#f5ebc1` with an ochre `#8a5a00` edge | Yellow `#f3d36b` edge only | |

In dark mode highlighted lines have no visible band, because any band pushes the dark token colors under 5.5:1. Diff markers (`ins`/`del`) still use Expressive Code's defaults; avoid them in teaching code until they get palette colors.

Rules:
- **Code wraps, never scrolls sideways.** Wrapped lines keep their indentation (`defaultProps: { wrap: true, preserveIndent: true }` in `ec.config.mjs`).
- **Nothing in a code theme is bold.** Bold is reserved for the μ/σ markers.
- **No blue and no pink in code themes.** Those hues belong to σ and μ.
- **Every token color is at least 5.5:1** against the code background, so Expressive Code's automatic contrast fix never changes it. `npm run check:design` enforces this.
- **Line numbers keep the palette colors.** `ec.config.mjs` sets `gutterForeground` and `gutterHighlightForeground` itself, because Expressive Code otherwise fades line numbers with alpha to about 3.6:1. `npm run check:design` asserts both.
- Dark-mode code ink (`#f2f0ea`) is deliberately brighter than body ink: the body ink sits too close to μ for color-blind readers.

### μ and σ in code

A small Expressive Code plugin (`src/design/ec-meaning-markers.mjs`) wraps identifiers named `mu`, `sigma` and their variants (`mu_hat`, `sigma_hat`, `TRUE_MU`) in `.ms-mu` / `.ms-sigma` spans. They are bold, in the meaning color, with a 1px inset ring and a faint fill. Occurrences inside strings and comments are left alone.

Name variables `mu` and `sigma` in teaching code so the markers apply.

### Runnable code

Use `PyRunner` for code the reader should run (see [components.md](components.md)). Keep PyTorch examples display-only and pair them with a runnable NumPy version: the browser runtime can't load PyTorch.
