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

### Guided pieces (`src/components/react/guided/`)
Small modules every guided board composes in its tray ([decision 0013](../decisions/0013-shared-board-modules.md)), so Check, stages, presets, refusals and announcements behave the same on every board. `Board` itself knows nothing about them. None of them holds wording: labels, legends and reasons come from each board's own copy.

| Piece | What it does |
|---|---|
| `guided.ts` | Pure rules, checked by `npm run check:boards`. `recordCheck(progress, passed, mode)` returns the new `{ checked, failedChecks }` to spread into the board's state: `'retry'` counts a miss and lets the reader try again, `'once'` reveals on any committed answer (a one-shot guess). It throws if Check has already passed. `canShowAnswer` is true after `CHECKS_BEFORE_ANSWER` (2) wrong Checks. `stageAllowed(stage, { stages, waitsForCheck, covered })` holds back stages that would give the answer away |
| `useAnnouncer()` | Returns `[announcement, announce]`: pass `announcement` to `Board`, and call `announce(text)` when an interaction ends, or `announce(text, KEYBOARD_COMMIT_DELAY_MS)` for a burst of key presses. The region empties and refills 50 ms later, so a repeated message is spoken again, and a newer message replaces one still waiting. The timing lives in the pure `announcer.ts` |
| `CheckButtons` | Check until it passes, then nothing; "Show the answer" once `canShowAnswer` is true. Props: `progress`, `checkLabel`, `showAnswerLabel`, `onCheck`, `onShowAnswer`, and `checkRefusalId` while Check is refused (for example before a sign is picked). Move focus to the verdict sentence when they disappear |
| `StageChoice` | A `TrayChoice` (usually legend "Show as") that offers only the stages `isAllowed` lets through, and draws nothing when fewer than two are left. Stages are left out, never shown disabled |
| `PresetButtons` | One labeled group of preset buttons: `label` (the group's name), `caption` (short visible text, hidden from screen readers), `presets`, `onPick`. Pass `activeId` when a preset stays selected (`aria-pressed`); pass `refusalId` while presets are refused |
| `refusedBy(reasonId)`, `RefusalNote` | A refused control stays focusable and pressable (`aria-disabled`, never `disabled`) and points at a `RefusalNote` with the visible reason through `aria-describedby`. The board's own handler decides what a refused press says. Notes are hidden in print with the controls they explain |

### `NormalDistribution`, `LinearRegression`, `BayesTheorem`
Concept boards. Each composes `Board`, Mafs, `plotColors`, and `TraySlider`s.

`BayesTheorem` also has "Example" preset buttons, defined with their math in `src/components/react/bayesTheorem/scenarios.ts` and checked by `npm run check:boards`: "Any two events" (the opening view), "Medical test" (1 in 100 has the condition, a test right 9 times in 10, so a positive means P(A | B) ≈ 0.083) and "Wet lawn" (rain or the sprinkler, P(A | B) ≈ 0.429). A line under the presets says what A and B stand for. When A's column is thinner than 0.15, its labels sit beside it. Try it at `/lab/bayes-theorem/`.

### `EventSpace`
A sample space as a table of outcomes (decision 0011). One prop: `setup`, the id of a configuration in `src/components/react/eventSpace/setups.ts` (`coins-build`, `dice-count`, `dice-operations`, `die-pour`, `dice-condition`, `kids-condition`, `coin-die-independence`, `dice-independence`, `weather-exclusive`, `die-compare`); an unknown id fails the build.

```mdx
<div class="not-content">
  <EventSpace client:visible setup="coins-build" />
</div>
```

- **Count mode:** readers tap outcomes to build event A (and B on two-event setups); readouts give exact counts and fractions, plus "not A", "A and B" and "A or B". An empty A ∩ B is worded, never drawn as "{}": "A and B: no shared outcome, 0 of 36". "Look at" mutes the outcomes outside a chosen set.
- **Goal setups** (`coins-build`): presets and readouts stay locked until the reader passes **Check**, which names the specific mistake (HT marked without TH). "Show the answer" appears after two wrong Checks.
- **Weights mode** (`die-pour`): six cups poured from a jug of 12 units, for the probability axioms. Impossible pours are refused with a visible reason.
- **Condition mode** (`dice-condition`, `kids-condition`): a "Shrink the world to B" switch rules out every outcome outside B (muted, struck through, "Ruled out" in its name), and the readout gives P(A | B) beside P(A). The switch is refused while B is empty, with the visible reason "Undefined: B can't happen (probability 0)." `kids-condition` is fixed data (a class of 12 children in a list layout without headers), so its cells can be read but not toggled.
- **Compare mode** (`coin-die-independence`, `dice-independence`, `weather-exclusive`, `die-compare`), for independence and mutual exclusivity: the readouts show P(A) and P(B) only, and a "Compare A and B" switch, off at the start, reveals the A ∩ B line and a comparison block: whether A and B are independent, whether they are mutually exclusive (with the shared outcomes), P(A and B) against P(A) × P(B), and P(A | B) beside P(A). Independence is decided only by P(A ∩ B) = P(A) P(B) in exact fractions, so an event that can't happen is reported as independent of everything ("Independent: yes, but only because B can't happen.") while P(A | B) is undefined. Exclusivity comes from the sets alone. "Shrink the world to B", where a setup offers it, is refused until Compare is on, so nothing answers the page's question before the reader acts; turning Compare off also leaves the shrunk view.
  - `coin-die-independence`: a coin beside a die (H1 to T6). A: Die is 6 (the opening), Die is even, Heads and a six, Clear. B: Coin is heads (the opening), Coin is tails, Clear.
  - `dice-independence`: two dice. A: Sum is 7 (the opening), Sum is 8, Doubles, Sum is at least 10. B: First die is 6 (the opening), Second die is 6, Doubles, Clear. Three of the comparison page's pairs load with A and B swapped (first die 6 with sum 7, doubles with sum 7, first die 6 with sum at least 10), and Clear B gives its empty-event case; the swap changes no number or verdict. Its fourth pair, first die 6 with second die 6, can't be loaded from presets, because neither event is an A preset and each event allows at most four, so that page makes the "overlap, yet independent" point with sum 7 and first die 6 instead. A has no Clear here; an empty A is reached on `coin-die-independence` and `die-compare`.
  - `weather-exclusive`: 12 fixed days (rain all day, sun all day, or sun and showers), read but not toggled. A: Rain all day, Some rain. B: Sun all day, Some sun.
  - `die-compare`: one die in a list layout, with a "Die" choice between Fair die and Loaded toward six (1, 1, 1, 1, 1 and 7 of 12 units, the same fills as `die-pour`). A and B come from presets only. Each cell shows its share of the 12 units ("2/12"), and readouts count units ("4 of 12 units = 1/3"). It shows that a loaded die changes independence and never changes exclusivity.
  - `validateSetup` refuses a compare setup without B, or with a goal, tosses, "Look at", stages or a wrong model; weights on any space but one die; a fill that doesn't pour exactly 12 units or leaves a face empty; and weights combined with shrinking.
- Check, "Show the answer", the "Show as" choice, the presets, the refusal notes and the live region are the guided pieces above.
- All math and copy live in pure modules (`model.ts`, `describe.ts`, `state.ts`) checked by `npm run check:boards`. Try every setup at `/lab/event-space/` in the dev server.

### `DistributionBoard`
A random variable as a bar chart ([decision 0012](../decisions/0012-distribution-board.md)). One prop: `setup`, the id of a configuration in `src/components/react/distributionBoard/setups.ts` (`candy-build`, `coins-heads`, `candy-balance`, `candy-spread`); an unknown id, or a setup whose values, presets or range can't work, fails the build.

```mdx
<div class="not-content">
  <DistributionBoard client:visible setup="candy-build" />
</div>
```

The reader gives each outcome a number with a − / + pair. Outcomes that share a number stack into one bar, and their chances add. The bars, the readout sentences and a table (`Value`, `Faces` or `Outcomes`, `P(X = x)`) all say the same thing.

- **Goal setups** (`candy-build`, `coins-heads`): a die whose faces win candies, or two coins counted by heads. The chart, fractions and table start covered, and only the − / + steppers work. The reader sets a value for each outcome and presses **Check**, which names the wrong faces; "Show the answer" appears after two wrong Checks. Once Check passes, the chart appears and the bars merge live as values change. A "Show as" choice offers Pictures and Numbers from the start; Symbols, which writes X as a function, and the presets wait for the match. `candy-build` then sets a follow-up goal, "make P(X = 1) = 1/2", with a **Check goal** button.
- **Balance setup** (`candy-balance`): an ochre pencil under the chart, moved by dragging the strip under the axis or with the tray's "Pencil position" slider. The plank stays level while the pencil moves. **"Balance it"** locks in the guess, shows the pink μ and tips the plank a fixed 6 degrees toward the heavy side, and a sentence always says which way and why. The − / + steppers are refused until then. Presets start a new game: the pencil parks and μ hides again.
- **Spread setup** (`candy-spread`): fixed values, with μ shown from the start. A "Show the spread" switch draws the distance arms and the blue σ. Switching presets while it is on keeps the previous σ as a dashed ghost for comparison.
- **Limits:** `validateSetup` allows at most 7 tile columns and 4 presets, so the board fits at 375px. On balance setups it also requires every preset's mean (and the opening values') to be a step the pencil can land on, and on spread setups that μ ± σ stays on the axis.
- **HTML board rules:** the board renders HTML inside the unchanged `Board`, never passes `onInteractionEnd` or `handleLabels`, and owns its live region through `useAnnouncer`. Check, stages, presets and refusals use the guided pieces above, as on EventSpace. Discrete pages never load Mafs. Island CSS lives under the `.ms-dist-*` section of `components.css`.
- All math and copy live in pure modules (`model.ts`, `describe.ts`, `state.ts`) checked by `npm run check:boards`. Try every setup at `/lab/distribution-board/` in the dev server.

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
| `Header` | Adds the subject strip (from `src/design/domains.mjs`) with an underline on the active subject. Search and the theme toggle stay Starlight's own; Search takes the space left beside the strip and drops "Ctrl K", then the word "Search", when it is narrow, so it never runs into the icons. While the search box is empty, the dialog shows "Browse by subject" (`src/components/SearchBrowse.astro`), built from `domains.mjs` and the published topics in `topics.mjs`, so released pages appear in it automatically; it hides as soon as you type |
| `Sidebar` | Wraps Starlight's own sidebar and adds the subject list at the top of the mobile menu |
| `TableOfContents` | Wraps Starlight's own "On this page" list and scrolls its panel (never the page) to keep the highlighted section in view when the list is taller than the window; jumps instead of gliding under reduced motion |
| `Footer` | Wraps Starlight's own footer and adds the author, the licenses (CC BY 4.0 text, MIT code), a prefilled "Report an error on this page" link and a link to the About page |

The sidebar is narrowed to the active subject by Starlight route middleware (`src/routeData.ts`), not by the override, so Starlight's sidebar markup and state persistence keep working. Subjects are defined once in `src/design/domains.mjs`, which feeds both the sidebar config and the strip; the build fails if they disagree.

## Writing new components

- Read tokens with `var(--ms-*)`; never write a hex value in a component.
- Don't use heading elements for UI labels (use `<p>` or `<span>`); Starlight renders the page h1 and prose owns h2–h6.
- Interactive targets are at least 44px tall.
- Use `useCallback` for Mafs handlers and constraint functions.
- Add the component to this file in the same change.
