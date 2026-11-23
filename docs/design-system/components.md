# Components

Every component reads colours from `--ms-*` tokens and works in both themes. Layout components are Astro (server-rendered, no JavaScript). Interactive pieces are React islands hydrated with `client:visible`.

In MDX, wrap React islands in `<div class="not-content">` so Starlight's prose styles don't leak in.

## Page structure

### `ConceptHeader` (Astro)
Opens every concept page, under the title Starlight renders.

| Prop | Type | Notes |
|---|---|---|
| `oneLiner` | `string` | One sentence saying what the concept is |
| `difficulty` | `'beginner' \| 'intermediate' \| 'advanced'` | Shown as a plain word ("Level: beginner"), not a coloured pill |
| `prerequisites` | `{ label, href }[]` | Optional. Rendered as a sentence of links |

### `WhyThisMatters` (Astro)
The ML relevance of the concept, straight after the header. Paper surface with a rule on the left; label "Why this matters in ML". Slot: one or two short paragraphs.

### `FormalDefinition` (Astro)
A `<details>` panel on the sunk surface holding the formal maths. Closed by default. Slot: KaTeX and prose.

### `CommonMistakes` (Astro) and `Mistake` (Astro)
A list of misconceptions, each as a "Not quite" / "Instead" pair.

```mdx
<CommonMistakes>
  <Mistake wrong="σ is the variance." right="σ is the standard deviation; the variance is σ²." />
</CommonMistakes>
```

### `NextTopics` (Astro)
A plain list of links at the end of a page. No cards.

| Prop | Type |
|---|---|
| `topics` | `{ label, href, description }[]` |

## Inline

### `Var` (Astro)
A variable symbol in its meaning colour, for prose. `name`: `'mu' | 'sigma'`. Renders an italic serif symbol with the matching class, so it matches the KaTeX macros.

### `SideNote` (Astro)
An aside for the margin: a short clarification, a historical note, a "you may have seen this written as". Inline on narrow screens; in the margin column on wide screens. Smaller serif in muted ink. Keep it under about 60 words.

## Boards (React)

### `Board`
The frame every interactive plot sits in. It sets Mafs' CSS variables from the tokens, draws the frame and the tray, and owns the keyboard and screen-reader alternatives.

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Accessible name of the figure, for example "Normal distribution with draggable mean and spread" |
| `children` | `ReactNode` | The Mafs canvas |
| `tray` | `ReactNode` | Sliders, readouts and buttons shown under the canvas |
| `onReset` | `() => void` | Optional; adds a Reset button to the tray |
| `announcement` | `string` | Text for the polite live region; update it only when an interaction ends |

### `ChalkNote`
A short handwritten note on a board, in Kalam at 20px or larger. Qualitative only ("wider bell, lower peak"), never a number. It takes a `long` and a `short` text and hides itself when the board is under 560px wide.

### `TraySlider`
A labelled slider for the tray, built on Base UI's Slider. Props: `label`, `value`, `min`, `max`, `step`, `onValueChange`, `onValueCommitted`, `format` (for the readout and `aria-valuetext`), `meaning` (`'mu' | 'sigma' | undefined`, which colours the thumb and label).

### `NormalDistribution`, `LinearRegression`, `BayesTheorem`
Concept boards. Each composes `Board`, Mafs, `plotColors`, and `TraySlider`s.

## Code

### Fenced code blocks
Plain Markdown fences render through Expressive Code with the tuned full palette, line numbers, and the μ/σ markers. Use `collapse={1-5}` to fold set-up lines, and `title="fit.py"` for a file name.

### `PyRunner` (React)
A runnable Python block. The code is shown with the same highlighting; a Run button loads Pyodide in a Web Worker on first click (about 9 MB with NumPy, so it shows a loading state), and output appears below. Stop restarts the worker.

| Prop | Type | Notes |
|---|---|---|
| `code` | `string` | The Python source |
| `title` | `string` | Optional file name or caption |

Only standard-library, NumPy and SciPy code can run. Keep PyTorch display-only.

## Site chrome (Starlight overrides)

Overrides live in `src/components/overrides/` and are registered in `astro.config.mjs`. Keep them few; each one is a maintenance cost on every Starlight upgrade.

| Override | What it changes |
|---|---|
| `Header` | Adds the domain strip (Statistics, Probability, Linear algebra, Machine learning) with an underline on the active domain. Search and the theme toggle stay Starlight's own |
| `Sidebar` | Shows only the active domain's pages, so the sidebar stays short |

## Writing new components

- Read tokens with `var(--ms-*)`; never write a hex value in a component.
- Don't use heading elements for UI labels (use `<p>` or `<span>`); Starlight renders the page h1 and prose owns h2–h6.
- Interactive targets are at least 44px tall.
- Use `useCallback` for Mafs handlers and constraint functions.
- Add the component to this file in the same change.
