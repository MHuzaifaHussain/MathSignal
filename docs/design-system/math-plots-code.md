# Maths, plots and code

The same three meaning colours run through formulas, plots and code. This file explains how to keep them consistent.

## Formulas (KaTeX)

Formulas are rendered at build time by `remark-math` and `rehype-katex` through Astro's `unified()` Markdown processor. No maths JavaScript ships to the browser, and KaTeX's hidden MathML stays in place for screen readers.

### Coloured variables

Use the macros, never `\color{}`:

| Write | Renders as |
|---|---|
| `\vmu` | μ in the μ colour |
| `\vsigma` | σ in the σ colour |

```mdx
$$
f(x) = \frac{1}{\vsigma\sqrt{2\pi}} \, e^{-\frac{(x-\vmu)^2}{2\vsigma^2}}
$$
```

The macros expand to `\htmlClass{ms-mu}{\mu}` and `\htmlClass{ms-sigma}{\sigma}`. KaTeX's `trust` option allows only `\htmlClass`, so `\href`, `\url` and the other trusted commands stay disabled.

Colour a variable only where the page is teaching it. In a long derivation, colour the first and the key occurrences, not every one.

### Variables in prose

Use the `Var` component, so prose matches the formulas:

```mdx
import Var from '../../../components/Var.astro';

The mean <Var name="mu" /> sets where the bell sits.
```

## Plots (Mafs boards)

Every interactive plot sits inside a `Board` (see [components.md](components.md)). The board sets Mafs' CSS variables from the tokens, so Mafs components need no colour logic.

In Mafs code, import colours from `src/components/react/plotColors.ts`:

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
| `plotColors.axis` | Secondary guides |

Never use `Theme.blue` or other Mafs defaults for meaning: they are not the design system's colours.

### Board behaviour

- Drags start only within 24px of a handle, so touch scrolling still works (`touch-action: pan-y` on the board, `none` while dragging).
- Every handle has a slider in the tray as a keyboard and screen-reader alternative, with `aria-valuetext` in words.
- A live region announces the new values when a drag or slider change ends, never on every frame.
- Handwritten notes (`ChalkNote`) sit in empty space and hide when the board is under 560px wide.

## Code (Expressive Code)

Code uses the **tuned full** palette: familiar editor-style highlighting with every colour chosen so it can't be mistaken for μ, σ or "look here", even with colour blindness.

| Token role | Light | Dark | Style |
|---|---|---|---|
| Keywords, built-ins, f-string braces, decorators | `#461f62` | `#b182ff` | Regular; decorators italic |
| Strings | `#0d4a22` | `#81a567` | Regular |
| Numbers, `True`, `None`, CONSTANTS | `#6c1f03` | `#f6781e` | Regular |
| Comments and docstrings | `#464236` | `#ac9879` | Italic |
| Names, calls, operators, parameters | `#1e2725` | `#f2f0ea` | Regular |
| Background | `#f6f8f7` | `#1f2423` | |

Rules:
- **Nothing in a code theme is bold.** Bold is reserved for the μ/σ markers.
- **No blue and no pink in code themes.** Those hues belong to σ and μ.
- **Every token colour is at least 5.5:1** against the code background, so Expressive Code's automatic contrast fix never changes it. `npm run check:design` enforces this.
- Dark-mode code ink (`#f2f0ea`) is deliberately brighter than body ink: the body ink sits too close to μ for colour-blind readers.

### μ and σ in code

A small Expressive Code plugin (`src/design/ec-meaning-markers.mjs`) wraps identifiers named `mu`, `sigma` and their variants (`mu_hat`, `sigma_hat`, `TRUE_MU`) in `.ms-mu` / `.ms-sigma` spans. They are bold, in the meaning colour, with a 1px inset ring and a faint fill. Occurrences inside strings and comments are left alone.

Name variables `mu` and `sigma` in teaching code so the markers apply.

### Runnable code

Use `PyRunner` for code the reader should run (see [components.md](components.md)). Keep PyTorch examples display-only and pair them with a runnable NumPy version: the browser runtime can't load PyTorch.
