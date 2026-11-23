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
A list of misconceptions, each as a "Not quite" / "Instead" pair. The misconception is the `wrong` prop; the correction is the slot, so it can hold formulas and links.

```mdx
<CommonMistakes>
  <Mistake wrong="σ is the variance.">
    σ is the standard deviation; the variance is $\sigma^2$.
  </Mistake>
</CommonMistakes>
```

### `NextTopics` (Astro)
A plain list of links at the end of a page. No cards.

| Prop | Type |
|---|---|
| `topics` | `{ label, href?, description }[]`. Leave `href` out for a page that isn't written yet: it renders as "coming soon" instead of a broken link |

## Inline

### `Var` (Astro)
A variable symbol in its meaning colour, for prose. `name`: `'mu' | 'sigma'`. Renders an italic serif symbol with the matching class, so it matches the KaTeX macros.

### `SideNote` (Astro)
A short aside: a clarification, a historical note, a "you may have seen this written as". Smaller serif in muted ink with a hairline on the left, inline in the reading column. (It does not float into the page margin: Starlight's "On this page" column occupies that space.) Keep it under about 60 words.

## Boards (React)

### `Board`
The frame every interactive plot sits in. It sets Mafs' CSS variables from the tokens, draws the frame and the tray, and owns the keyboard and screen-reader alternatives.

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Accessible name of the figure, for example "Normal distribution with draggable mean and spread" |
| `children` | `ReactNode` | The Mafs canvas |
| `tray` | `ReactNode` | Optional. Sliders, readouts and buttons shown under the canvas |
| `onReset` | `() => void` | Optional; adds a Reset button to the tray |
| `announcement` | `string` | Text for the polite live region; update it only when an interaction ends |
| `onInteractionEnd` | `() => void` | Optional. Called once when a drag or an arrow-key move on the canvas ends; set `announcement` here. Board listens in the capture phase because Mafs captures the pointer and stops `pointerup`/`keyup` from bubbling |
| `handleLabels` | `string[]` | Optional. Names for the canvas's draggable handles, in render order. Given: the handles stay keyboard-focusable and are announced as draggable points. Omitted: the tray sliders are the keyboard path, so the handles are removed from the tab order and the accessibility tree |

### `ChalkNote`
A short handwritten note on a board, in Kalam at 20px or larger. Qualitative only ("wider bell, lower peak"), never a number. It takes a `long` and a `short` text and shows the `short` one when the board is under 560px wide.

### `TraySlider`
A labelled slider for the tray, built on Base UI's Slider. Props: `label`, `value`, `min`, `max`, `step`, `largeStep` (optional; PageUp/PageDown and Shift+Arrow, defaults to about a tenth of the range), `onValueChange`, `onValueCommitted` (called once per drag, and once after a short pause for keyboard changes, so the board announces once), `format` (readout text, and `aria-valuetext` unless `describe` is given), `describe` (optional spoken value, e.g. "mean 1.50"), `meaning` (`'mu' | 'sigma' | undefined`, which colours the thumb and label).

### `NormalDistribution`, `LinearRegression`, `BayesTheorem`
Concept boards. Each composes `Board`, Mafs, `plotColors`, and `TraySlider`s.

## Code

### Fenced code blocks
Plain Markdown fences render through Expressive Code with the tuned full palette, line numbers, and the μ/σ markers. Use `collapse={1-5}` to fold set-up lines, and `title="fit.py"` for a file name.

### `PyRunner` (Astro, wraps the `PyRunControls` React island)
A runnable Python block. The code is rendered by Starlight's `<Code>` component, so it has the same highlighting and μ/σ markers as every fence. A Run button loads Pyodide 314 from jsDelivr in a Web Worker on first click (about 9 MB with NumPy, so it shows a loading state), and output appears below. Stop terminates the worker; the next Run starts a fresh one. A failed download shows a plain "check your connection" message; Python exceptions show their traceback.

| Prop | Type | Notes |
|---|---|---|
| `code` | `string` | The Python source |
| `title` | `string` | Optional file name or caption |

Only standard-library, NumPy and SciPy code can run. Keep PyTorch display-only.

## Embeds

### `MarimoEmbed` (React)
Embeds a published marimo notebook in an iframe, with a title bar and an "Open in marimo" link. Not used on any page yet.

| Prop | Type | Notes |
|---|---|---|
| `src` | `string` | URL of the published notebook |
| `height` | `string` | CSS height, default `600px` |
| `mode` | `'edit' \| 'read'` | Default `edit` |
| `title` | `string` | Optional; shows the title bar |

The iframe sandbox allows scripts and same-origin access, which marimo needs. Only embed notebooks from a host you trust, and never from this site's own origin (same-origin plus scripts would let the frame lift its own sandbox).

## Site chrome (Starlight overrides)

Overrides live in `src/components/overrides/` and are registered in `astro.config.mjs`. Keep them few; each one is a maintenance cost on every Starlight upgrade.

| Override | What it changes |
|---|---|
| `Header` | Adds the subject strip (from `src/design/domains.mjs`) with an underline on the active subject. Search and the theme toggle stay Starlight's own |
| `Sidebar` | Wraps Starlight's own sidebar and adds the subject list at the top of the mobile menu |

The sidebar is narrowed to the active subject by Starlight route middleware (`src/routeData.ts`), not by the override, so Starlight's sidebar markup and state persistence keep working. Subjects are defined once in `src/design/domains.mjs`, which feeds both the sidebar config and the strip; the build fails if they disagree.

## Writing new components

- Read tokens with `var(--ms-*)`; never write a hex value in a component.
- Don't use heading elements for UI labels (use `<p>` or `<span>`); Starlight renders the page h1 and prose owns h2–h6.
- Interactive targets are at least 44px tall.
- Use `useCallback` for Mafs handlers and constraint functions.
- Add the component to this file in the same change.
