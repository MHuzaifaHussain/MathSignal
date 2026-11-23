# Working on MathSignal

Guidance for contributors and coding agents. Keep it short; details live in the linked docs.

## Before changing anything visual
- Read [docs/design-system/README.md](docs/design-system/README.md). New concept pages follow [writing-a-concept-page.md](docs/design-system/writing-a-concept-page.md).
- Big choices are recorded in [docs/decisions/](docs/decisions/). Add a record before making a change of similar size.

## AI assistant skills
Before any change, recommend the matching skills from [docs/tooling/agent-skills.md](docs/tooling/agent-skills.md) and ask whether to use them. If a recommended skill or tool isn't installed, suggest installing it with the command listed there. Never install anything without the developer's go-ahead.

## Rules that are easy to break
- Colours come only from `src/design/palette.mjs`. Run `npm run tokens` after changing it; never edit `src/styles/tokens.css` by hand. Components use `var(--ms-*)`, never hex values.
- Colour means something: pink is μ, blue is σ, yellow/ochre is "look here". Everything else is ink. Use `\vmu`/`\vsigma` in formulas, `<Var>` in prose, `plotColors` in Mafs code.
- Code themes have no bold and no blue or pink; every token stays at least 5.5:1. `npm run check:design` enforces this.
- Plots live inside `Board`; every draggable handle needs a keyboard path (a tray slider, or `handleLabels`).
- Subjects are defined once in `src/design/domains.mjs`.
- React islands use `client:visible` and sit inside `<div class="not-content">` in MDX. Island CSS goes in `src/styles/components.css` (islands drop CSS imports).
- There is no Tailwind (decision 0005). Style with tokens in scoped `<style>` blocks or `components.css`; Starlight's own utilities (`sl-flex`, `sr-only`, `print:hidden`) are fine.
- Don't use `starlight-katex`. Maths runs through `remark-math` + `rehype-katex` on Astro's `unified()` processor; Astro 7's default Sätteri processor breaks `$$` blocks.

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Static build; runs `check:design` first |
| `npm run check` | Type-checks `.astro`, `.ts`, `.tsx` |
| `npm run check:design` | Contrast and colour-blindness rules, tokens up to date |
| `npm run tokens` | Regenerates `src/styles/tokens.css` from the palette |

Node 24 (see `.nvmrc`).
