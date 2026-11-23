# Chalk Margin: the MathSignal design system

MathSignal teaches the maths behind machine learning. Chalk Margin is the visual system that every page, component and plot follows. Read this file first; the other files go deeper.

| File | What it covers |
|---|---|
| [foundations.md](foundations.md) | Surfaces, colour roles, typography, spacing, focus, motion |
| [components.md](components.md) | Every component, when to use it, and its props |
| [math-plots-code.md](math-plots-code.md) | KaTeX conventions, μ/σ colouring, Mafs boards, code highlighting |
| [accessibility.md](accessibility.md) | Contrast rules, colour-blindness rules, keyboard and screen-reader requirements |
| [writing-a-concept-page.md](writing-a-concept-page.md) | The concept page template and a pre-merge checklist |
| [../decisions/](../decisions/) | Why the big choices were made (themes, code colours, stack) |

## The idea in one paragraph

A lecture hall: you **read on paper**, the teacher **draws on the board**, and you **write notes in the margin**. Each surface has one job. Paper holds prose and formulas in a calm serif. The board holds every interactive plot, with handwritten notes and a tray of controls. The margin holds side notes. Colour is reserved for meaning, so a reader learns once that pink is μ and blue is σ, and that rule holds in the text, the formulas, the plots and the code.

## Five rules

1. **Colour means something or it isn't there.** The only saturated colours are μ (pink), σ (blue) and "look here" (yellow, ochre on light paper). Everything else is ink, muted ink, rules and the board's green-grey.
2. **One job per surface.** Prose on paper, interaction on boards, asides in the margin. Never put long prose on a board or a plot on paper.
3. **Two complete themes.** Light mode is fully light (pale board, light header). Dark mode is fully dark (slate board). Components never hard-code colours; they read `--ms-*` tokens, which switch with the theme.
4. **Handwriting is a garnish.** Kalam appears only on boards, at 20px or larger, for short qualitative notes. Never for numbers, labels or anything a reader must parse precisely.
5. **No decoration without information.** No cards, pills, drop shadows or gradients. Borders, numbering and labels exist only when they encode structure.

## Where things live

| Path | Role |
|---|---|
| `src/design/palette.mjs` | **Single source of truth** for every colour and font stack, plus the contrast rules |
| `src/styles/tokens.css` | Generated CSS custom properties (`--ms-*`). Never edit by hand |
| `src/styles/global.css` | Maps tokens onto Starlight, Mafs and KaTeX; global element styles |
| `src/design/code-themes.mjs` | Builds the Expressive Code light and dark themes from the palette |
| `scripts/check-design.mjs` | Fails the build if any contrast or colour-blindness rule breaks |
| `src/components/` | Astro layout components (server-rendered) |
| `src/components/react/` | React islands (boards, tray sliders, `PyRunControls` and its Pyodide worker) |
| `src/design/domains.mjs` | The subject list, shared by the sidebar and the header strip |
| `src/routeData.ts` | Starlight route middleware that narrows the sidebar to the active subject |
| `src/components/overrides/` | Starlight component overrides (header, sidebar) and the subject strip |

## Visual reference

The running site is the visual reference: the Normal distribution page shows every component, both themes and all three surfaces. The preview pages made while choosing this direction are superseded (they still show an early half-dark light mode and quiet code colours) and are not needed to work on the site.

## Changing the system

- **Change a colour:** edit `src/design/palette.mjs`, run `npm run tokens`, then `npm run check:design`. If the check fails, the colour is not allowed; pick another. Never bypass the check.
- **Add a colour role:** add it to both `light` and `dark` in the palette, add a contrast rule for every surface it appears on, document it in [foundations.md](foundations.md).
- **Add a component:** follow the patterns in [components.md](components.md), use tokens only, support both themes, and add it to that file.
- **Make a big change:** write a short decision record in `docs/decisions/` first.

## Checks

| Command | What it does |
|---|---|
| `npm run check:design` | Contrast and colour-separation rules, tokens file up to date. Runs automatically before `npm run build` |
| `npm run tokens` | Regenerates `src/styles/tokens.css` |
| `npm run build` | Full static build; fails if the design check fails |
| `npm run check` | Type-checks `.astro`, `.ts` and `.tsx` files (`astro check`) |
