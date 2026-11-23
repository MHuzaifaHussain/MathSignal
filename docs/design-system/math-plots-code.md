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
- Handwritten notes (`ChalkNote`) sit at the board's top-left and switch to their `short` text when the board is under 560px wide.

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
- Dark-mode code ink (`#f2f0ea`) is deliberately brighter than body ink: the body ink sits too close to μ for color-blind readers.

### μ and σ in code

A small Expressive Code plugin (`src/design/ec-meaning-markers.mjs`) wraps identifiers named `mu`, `sigma` and their variants (`mu_hat`, `sigma_hat`, `TRUE_MU`) in `.ms-mu` / `.ms-sigma` spans. They are bold, in the meaning color, with a 1px inset ring and a faint fill. Occurrences inside strings and comments are left alone.

Name variables `mu` and `sigma` in teaching code so the markers apply.

### Runnable code

Use `PyRunner` for code the reader should run (see [components.md](components.md)). Keep PyTorch examples display-only and pair them with a runnable NumPy version: the browser runtime can't load PyTorch.
