# Chalk Margin: the MathSignal design system

MathSignal teaches the math behind machine learning. Chalk Margin is the visual system that every page, component and plot follows. Read this file first; the other files go deeper.

| File | What it covers |
|---|---|
| [foundations.md](foundations.md) | Surfaces, color roles, typography, spacing, focus, motion |
| [components.md](components.md) | Every component, when to use it, and its props |
| [math-plots-code.md](math-plots-code.md) | KaTeX conventions, μ/σ coloring, Mafs boards, code highlighting |
| [accessibility.md](accessibility.md) | Contrast rules, color-blindness rules, keyboard and screen-reader requirements |
| [writing-a-concept-page.md](writing-a-concept-page.md) | The concept page template and a pre-merge checklist |
| [../seo/README.md](../seo/README.md) | Balanced SEO principles and the new-page SEO checklist |
| [../decisions/](../decisions/) | Why the big choices were made (themes, code colors, stack) |

## The idea in one paragraph

A lecture hall: you **read on paper**, the teacher **draws on the board**, and you **write notes in the margin**. Each surface has one job. Paper holds prose and formulas in a calm serif. The board holds every interactive plot, with handwritten notes and a tray of controls. The margin holds side notes. Color is reserved for meaning, so a reader learns once that pink is μ and blue is σ, and that rule holds in the text, the formulas, the plots and the code.

## Five rules

1. **Color means something or it isn't there.** The only saturated colors are μ (pink), σ (blue) and "look here" (yellow, ochre on light paper). Everything else is ink, muted ink, rules and the board's green-gray.
2. **One job per surface.** Prose on paper, interaction on boards, asides in the margin. Never put long prose on a board or a plot on paper.
3. **Two complete themes.** Light mode is fully light (pale board, light header). Dark mode is fully dark (slate board). Components never hard-code colors; they read `--ms-*` tokens, which switch with the theme.
4. **Handwriting is a garnish.** Kalam appears only on boards, at 20px or larger, for short qualitative notes. Never for numbers, labels or anything a reader must parse precisely.
5. **No decoration without information.** No cards, pills, drop shadows, gradients or decorative vertical bars. Columns are separated by whitespace; blocks are set apart by a label, spacing or the sunk surface. Borders, numbering and labels exist only when they encode structure ([decision 0006](../decisions/0006-no-decorative-rules-or-shadows.md)).

## Rules that are easy to break

- Colors come only from `src/design/palette.mjs`. Run `npm run tokens` after changing it; never edit `src/styles/tokens.css` by hand. Components use `var(--ms-*)`, never hex values.
- Use `\vmu`/`\vsigma` in formulas, `<Var>` in prose and `plotColors` in Mafs code, so μ and σ keep their colors everywhere.
- Code themes have no bold and no blue or pink; every token stays at least 5.5:1. `npm run check:design` enforces this.
- Plots live inside `Board`; every draggable handle needs a keyboard path (a tray slider, or `handleLabels`). Discrete boards are HTML tables (decision 0011).
- Subjects are defined once in `src/design/domains.mjs`. Topics, symbols and references are defined once in `src/data/` and used by id (decision 0009).
- Concept pages follow the spine-and-folds template (decision 0008) with the full frontmatter in [writing-a-concept-page.md](writing-a-concept-page.md); the build stops without it.
- React islands use `client:visible` and sit inside `<div class="not-content">` in MDX. Island CSS goes in `src/styles/components.css` (islands drop CSS imports).
- There is no Tailwind (decision 0005). Style with tokens in scoped `<style>` blocks or `components.css`; Starlight's own utilities (`sl-flex`, `sr-only`, `print:hidden`) are fine.
- Don't use `starlight-katex`. Math runs through `remark-math` + `rehype-katex` on Astro's `unified()` processor; Astro 7's default processor breaks `$$` blocks.
- American English everywhere (decision 0010); `npm run check:content` fails on British spellings in page prose.
- Big choices get a decision record in `docs/decisions/` before the change.

## Where things live

| Path | Role |
|---|---|
| `src/design/palette.mjs` | **Single source of truth** for every color and font stack, plus the contrast rules |
| `src/styles/tokens.css` | Generated CSS custom properties (`--ms-*`). Never edit by hand |
| `src/styles/global.css` | Maps tokens onto Starlight, Mafs and KaTeX; global element styles |
| `src/design/code-themes.mjs` | Builds the Expressive Code light and dark themes from the palette |
| `scripts/check-design.mjs` | Fails the build if any contrast or color-blindness rule breaks |
| `src/components/` | Astro layout components (server-rendered) |
| `src/components/react/` | React islands (boards, tray sliders, `PyRunControls` and its Pyodide worker) |
| `src/design/domains.mjs` | The subject list, shared by the sidebar and the header strip |
| `src/data/` | Topic, notation and reference registries that pages refer to by id ([decision 0009](../decisions/0009-single-sources-of-truth.md)) |
| `src/routeData.ts` | Starlight route middleware that narrows the sidebar to the active subject |
| `src/components/overrides/` | Starlight component overrides (header, sidebar, footer) and the subject strip |

## Visual reference

The running site is the visual reference: the Normal distribution page shows every component, both themes and all three surfaces. The preview pages made while choosing this direction are superseded (they still show an early half-dark light mode and quiet code colors) and are not needed to work on the site.

## Changing the system

- **Change a color:** edit `src/design/palette.mjs`, run `npm run tokens`, then `npm run check:design`. If the check fails, the color is not allowed; pick another. Never bypass the check.
- **Add a color role:** add it to both `light` and `dark` in the palette, add a contrast rule for every surface it appears on, document it in [foundations.md](foundations.md).
- **Add a component:** follow the patterns in [components.md](components.md), use tokens only, support both themes, and add it to that file.
- **Make a big change:** write a short decision record in `docs/decisions/` first.

## Checks

| Command | What it does |
|---|---|
| `npm run check:design` | Contrast and color-separation rules, tokens file up to date. Runs automatically before `npm run build` |
| `npm run tokens` | Regenerates `src/styles/tokens.css` |
| `npm run check:content` | Registry ids, prerequisite graph, the ids each page uses, draft/topic status, description length, unique titles, descriptions and primary queries, and American spelling in page prose. Runs automatically before `npm run build` |
| `npm run check:code` | Runs every `PyRunner` example under Pyodide and fails on an error or failed `assert`. Run before merging a page with runnable code |
| `npm run check:boards` | Asserts the pure logic and copy of the boards and page components: the boards' math, sentences and state rules, the footer's citation, and the distributions registry behind `PropertiesTable`. Runs automatically before `npm run build` |
| `npm run check:links` | Every internal link, `#anchor` and image in `dist/` resolves, and page links end in a slash. Runs automatically after `npm run build` |
| `npm run build` | Full static build; fails if the design, content or link check fails, a formula is broken, or concept-page frontmatter is missing |
| `npm run check` | Type-checks `.astro`, `.ts` and `.tsx` files (`astro check`) |
