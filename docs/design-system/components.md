# Components

Every component reads colors from `--ms-*` tokens and works in both themes. Layout components are Astro (server-rendered, no JavaScript). Interactive pieces are React islands hydrated with `client:visible`.

In MDX, wrap React islands in `<div class="not-content">` so Starlight's prose styles don't leak in.

## Page structure

### `ConceptHeader` (Astro)
Opens every concept page, under the title Starlight renders. Prerequisites and objectives come from the page's frontmatter and `src/data/topics.mjs`, not from props.

| Prop | Type | Notes |
|---|---|---|
| `oneLiner` | `string` | One sentence that names the concept and says what it is |
| `difficulty` | `'beginner' \| 'intermediate' \| 'advanced'` | Shown as a plain word ("Level: beginner"), not a colored pill |

It renders, in order: the level, the one-liner, a "Before you start" list (each prerequisite from the topic registry with its one-line recap), "On this page you will" (the frontmatter `objectives`), and a skip line linking to the precise statement, formal definition, research frontier and references for readers who already know the basics.

### `WhyThisMatters` (Astro)
The ML relevance of the concept, after the everyday section. Paper surface set apart by its label "Why this matters in ML" and extra spacing, with no bar. Slot: one short paragraph.

### `FormalDefinition` (Astro)
A `<details>` panel (`id="formal-definition"`, summary "Formal definition, derivations and properties") on the sunk surface, holding `StepThrough` derivations and the properties table. A plain sunk band: no outline, no rounded corners, no inner rule. Closed by default; the precise statement stays outside it, always visible. Slot: KaTeX and prose.

### `CommonMistakes` (Astro) and `Mistake` (Astro)
A list of misconceptions, each as a "Not quite" / "Instead" pair. The page puts a `## Common mistakes` heading above it, so it appears in the table of contents. The misconception is the `wrong` prop; the correction is the slot, so it can hold formulas and links.

```mdx
<CommonMistakes>
  <Mistake wrong="σ is the variance.">
    σ is the standard deviation; the variance is $\sigma^2$.
  </Mistake>
</CommonMistakes>
```

### `Takeaways`, `ConceptMap`, `References` (Astro)
The closing sections, each under its own `##` heading in the page. All three read the page's frontmatter, so they take no props.

- `Takeaways` lists the frontmatter `takeaways` (three to five sentences).
- `ConceptMap` lists "Builds on" and "Leads to" from `src/data/topics.mjs`. Topics without a page show as "coming soon" instead of a broken link. It is a `nav` landmark only when it holds at least one link.
- `References` lists the frontmatter `references` ids, resolved from `src/data/references.mjs`, each with an `id="ref-…"` anchor that `Cite` links to.

## Teaching layers

The components behind the spine-and-folds template ([decision 0008](../decisions/0008-spine-and-folds-article-template.md)). Folds are plain `<details>`: closed by default, no headings inside, and opened automatically when the URL hash is their id or something inside them.

| Component | Props | Use |
|---|---|---|
| `Fold` | `kind` (`simpler` \| `deeper` \| `check` \| `answer`), `label`, `id?`, `open?` | The shared primitive. Pages use the wrappers below |
| `Simpler` | `label`, `id?` | A new picture, analogy or numbers for a beginner. Never a repeat of the spine |
| `GoDeeper` | `label`, `id?` | Derivations, edge cases, generalizations |
| `Analogy` | `breaks` (required) | The everyday section's text, followed by a bold "Where this picture breaks." paragraph from `breaks`. Plain prose, no box |
| `NotationKey` | `symbols` (ids from `src/data/notation.mjs`) | Symbol / Say it / Meaning table. Unknown ids fail the build |
| `PreciseStatement` | none | The always-visible exact definition with its conditions (`id="precise-statement"`) |
| `StepThrough` | `title`, `rigor?` (`sketch` \| `full`) | A numbered derivation, labeled "sketch" unless it is a full proof. Put an ordered list in the slot |
| `WorkedExample` | `number`, `title`, `faded?` | A worked example. With `faded`, the solution goes in `<div slot="solution">` and sits behind an "Answer" fold |
| `CheckYourself` | `question`, `level` (`intuition` \| `standard` \| `proof`) | A self-test question with its answer in a fold. The answer explains why |
| `Cite` | `id` | An inline citation linking to `#ref-id`. The id must also be in the frontmatter `references` |
| `ResearchFrontier` | `reviewed` (YYYY-MM-DD) | Open questions and recent work, with the date it was last checked (`id="research-frontier"`) |

`src/design/renderTex.mjs` renders TeX in Astro components (for example the notation table) with the same macros as page formulas, and throws on a broken formula.

## Inline

### `Var` (Astro)
A variable symbol in its meaning color, for prose. `name`: `'mu' | 'sigma'`. Renders an italic serif symbol with the matching class, so it matches the KaTeX macros.

### `SideNote` (Astro)
A short aside: a clarification, a historical note, a "you may have seen this written as". Smaller serif in muted ink, indented, with no bar, inline in the reading column. (It does not float into the page margin: Starlight's "On this page" column occupies that space.) Keep it under about 60 words.

## Boards (React)

### `Board`
The frame every interactive board sits in. It sets Mafs' CSS variables from the tokens, draws the frame and the tray, and owns the keyboard and screen-reader alternatives. Its content is either a Mafs canvas or, for discrete spaces, an HTML table (decision 0011).

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | Accessible name of the figure, for example "Normal distribution with draggable mean and spread" |
| `children` | `ReactNode` | A Mafs canvas, or an HTML table for discrete content. HTML boards own their announcements: they don't pass `onInteractionEnd` or `handleLabels` |
| `tray` | `ReactNode` | Optional. Sliders, readouts and buttons shown under the canvas |
| `onReset` | `() => void` | Optional; adds a Reset button to the tray |
| `announcement` | `string` | Text for the polite live region; update it only when an interaction ends |
| `onInteractionEnd` | `() => void` | Optional. Called once when a drag or an arrow-key move on the canvas ends; set `announcement` here. Board listens in the capture phase because Mafs captures the pointer and stops `pointerup`/`keyup` from bubbling |
| `handleLabels` | `string[]` | Optional. Names for the canvas's draggable handles, in render order. Given: the handles stay keyboard-focusable and are announced as draggable points. Omitted: the tray sliders are the keyboard path, so the handles are removed from the tab order and the accessibility tree |

### `ChalkNote`
A short handwritten note on a board, in Kalam at 20px or larger. Qualitative only ("wider bell, lower peak"), never a number. It takes a `long` and a `short` text and shows the `short` one when the board is under 560px wide.

### `TraySlider`
A labeled slider for the tray, built on Base UI's Slider. Props: `label`, `value`, `min`, `max`, `step`, `largeStep` (optional; PageUp/PageDown and Shift+Arrow, defaults to about a tenth of the range), `onValueChange`, `onValueCommitted` (called once per drag, and once after a short pause for keyboard changes, so the board announces once), `format` (readout text, and `aria-valuetext` unless `describe` is given), `describe` (optional spoken value, e.g. "mean 1.50"), `meaning` (`'mu' | 'sigma' | undefined`, which colors the thumb and label).

### `TrayChoice`
A segmented choice for the tray: a fieldset of native radios styled as buttons, so arrow keys and screen readers work natively. Props: `legend`, `options` (`{ value, label }[]`), `value`, `onChange`. The selected option is shown by fill and weight, never by color alone.

### `NormalDistribution`, `LinearRegression`, `BayesTheorem`
Concept boards. Each composes `Board`, Mafs, `plotColors`, and `TraySlider`s.

`BayesTheorem` also has "Example" preset buttons, defined with their math in `src/components/react/bayesTheorem/scenarios.ts` and checked by `npm run check:boards`: "Any two events" (the opening view), "Medical test" (1 in 100 has the condition, a test right 9 times in 10, so a positive means P(A | B) ≈ 0.083) and "Wet lawn" (rain or the sprinkler, P(A | B) ≈ 0.429). A line under the presets says what A and B stand for. When A's column is thinner than 0.15, its labels sit beside it. Try it at `/lab/bayes-theorem/`.

### `EventSpace`
A sample space as a table of outcomes (decision 0011). One prop: `setup`, the id of a configuration in `src/components/react/eventSpace/setups.ts` (`coins-build`, `dice-count`, `dice-operations`, `die-pour`, `dice-condition`, `kids-condition`); an unknown id fails the build.

```mdx
<div class="not-content">
  <EventSpace client:visible setup="coins-build" />
</div>
```

- **Count mode:** readers tap outcomes to build event A (and B on two-event setups); readouts give exact counts and fractions, plus "not A", "A and B" and "A or B". "Look at" mutes the outcomes outside a chosen set.
- **Goal setups** (`coins-build`): presets and readouts stay locked until the reader passes **Check**, which names the specific mistake (HT marked without TH). "Show the answer" appears after two wrong Checks.
- **Weights mode** (`die-pour`): six cups poured from a jug of 12 units, for the probability axioms. Impossible pours are refused with a visible reason.
- **Condition mode** (`dice-condition`, `kids-condition`): a "Shrink the world to B" switch rules out every outcome outside B (muted, struck through, "Ruled out" in its name), and the readout gives P(A | B) beside P(A). The switch is refused while B is empty, with the visible reason "Undefined: B can't happen (probability 0)." `kids-condition` is fixed data (a class of 12 children in a list layout without headers), so its cells can be read but not toggled.
- All math and copy live in pure modules (`model.ts`, `describe.ts`, `state.ts`) checked by `npm run check:boards`. Try every setup at `/lab/event-space/` in the dev server.

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
| `Header` | Adds the subject strip (from `src/design/domains.mjs`) with an underline on the active subject. Search and the theme toggle stay Starlight's own; Search takes the space left beside the strip and drops "Ctrl K", then the word "Search", when it is narrow, so it never runs into the icons |
| `Sidebar` | Wraps Starlight's own sidebar and adds the subject list at the top of the mobile menu |
| `Footer` | Wraps Starlight's own footer and adds the author, the licenses (CC BY 4.0 text, MIT code), a prefilled "Report an error on this page" link and a link to the About page |

The sidebar is narrowed to the active subject by Starlight route middleware (`src/routeData.ts`), not by the override, so Starlight's sidebar markup and state persistence keep working. Subjects are defined once in `src/design/domains.mjs`, which feeds both the sidebar config and the strip; the build fails if they disagree.

## Writing new components

- Read tokens with `var(--ms-*)`; never write a hex value in a component.
- Don't use heading elements for UI labels (use `<p>` or `<span>`); Starlight renders the page h1 and prose owns h2–h6.
- Interactive targets are at least 44px tall.
- Use `useCallback` for Mafs handlers and constraint functions.
- Add the component to this file in the same change.
