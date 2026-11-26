# Foundations

All values below come from `src/design/palette.mjs`. Use the CSS custom property (`--ms-*`), never the hex value.

## Surfaces

| Surface | Purpose | Light | Dark |
|---|---|---|---|
| Paper (`--ms-page`) | All reading: prose, formulas, code | White | Night `#171b1a` |
| Ledge (`--ms-ledge`) | Site header with the domain strip | White with a rule below | Slate, same as the board |
| Board (`--ms-board`) | Every interactive plot | Pale green-gray with a frame | Slate with a brighter frame |
| Tray (`--ms-board-tray`) | Sliders, readouts and Reset under a board | Slightly darker green-gray | Darker slate |
| Side note | Asides (`SideNote`), inline in the reading column with a hairline on the left (the page margin holds Starlight's "On this page" list) | Paper, smaller serif | Paper, smaller serif |
| Sunk (`--ms-surface-sunk`) | Quiet backgrounds such as the definition panel | `#f4f6f5` | `#1f2423` |

Board limits: at most two boards per page, each at most about 480px tall at the base size (see [Large screens](#large-screens)). A board always has its frame (`--ms-board-edge`). In dark mode the frame is what separates the board from the page.

## Color roles

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Ink | `--ms-ink` | `#1e2725` | `#ece8df` | Body text, headings |
| Muted ink | `--ms-ink-muted` | `#56625e` | `#a9b0ad` | Captions, metadata, side notes |
| Rule | `--ms-rule` | `#d5dbd9` | `#323a38` | Hairlines and borders (decorative) |
| Accent | `--ms-accent` | `#2f5048` | `#9fc2b8` | Starlight UI accent (current sidebar item, buttons). Derived from the board's green-gray, never a meaning color |
| μ | `--ms-mu` | `#b0306a` | `#f59ab4` | The mean, everywhere: prose, KaTeX, plots, code |
| σ | `--ms-sigma` | `#1f5fa8` | `#8dc8f2` | The spread, everywhere |
| Look here, line | `--ms-attention` | `#8a5a00` ochre | `#f3d36b` yellow | Focus rings on boards, drag highlights, the active domain underline |
| Look here, fill | `--ms-attention-fill` | `#f2d45c` | `#f3d36b` | Fills only, with ink on top. Never as a line on light paper |
| Highlighter | `--ms-highlight` | `#fbe7a1` | `#4a4022` | `<mark>` behind text |
| Board surface | `--ms-board` | `#e4ebe6` | `#22302e` | The board itself |
| Board frame | `--ms-board-edge` | `#677c73` | `#6a8079` | The board's border; in dark mode it is what separates the board from the page |
| Board tray | `--ms-board-tray` | `#d8e1db` | `#1a2523` | The control strip under a board |
| Header ledge | `--ms-ledge` | `#ffffff` | `#22302e` | Site header background |
| Board ink | `--ms-board-ink` | `#26332f` | `#ece8df` | Handwritten notes, labels on the board |
| Board axis | `--ms-board-axis` | `#677c73` | `#6a8079` | Axes, ticks and slider tracks |
| Board grid | `--ms-board-grid` | `#c4d0ca` | `#2f403d` | Grid lines (decorative, deliberately faint) |

This table lists the roles you choose between when building. The complete set, including code colors and the muted variants, is in `src/design/palette.mjs`.

**Adding a new meaning color is a design decision**, not a styling choice. It needs a decision record, a contrast rule on every surface, and separation from μ, σ and attention for color-blind readers.

Variables other than μ and σ (for example a slope or a prior) are written in ink. Color them only when a page is about that variable, and then only after adding a role as above.

## Typography

| Role | Family | Token | Where |
|---|---|---|---|
| Reading | Literata (variable) | `--ms-font-serif` | Body text, headings, side notes |
| Interface | Atkinson Hyperlegible Next | `--ms-font-ui` | Header, sidebar, buttons, tray, captions, tables |
| Code | Atkinson Hyperlegible Mono | `--ms-font-mono` | Code blocks, inline code, numeric readouts |
| Handwriting | Kalam | `--ms-font-hand` | Board notes only, 20px minimum |

Sizes below are at the base size, on screens up to 1920px wide; above that everything grows together ([Large screens](#large-screens)).

| Element | Size / line height | Weight |
|---|---|---|
| Body | 18px / 1.65, measure ≤ 66ch | 400 |
| Side note | 15px / 1.5 | 400 |
| h1 (page title, rendered by Starlight) | 2.25rem / 1.2 | 600 |
| h2 | 1.6rem / 1.25 | 600 |
| h3 | 1.25rem / 1.3 | 600 |
| UI text | 15px / 1.4 | 400–600 |
| Code | 15px / 1.6 | 400; bold reserved for μ/σ markers |

Fonts are self-hosted from Fontsource packages listed in Starlight's `customCss` (`astro.config.mjs`), Latin and other subsets split by `unicode-range`. A font file downloads only when text on the page uses it, so Kalam loads only on pages with a board note.

Typographic rules:
- Sentence case everywhere. No all-caps labels and no tracked-out eyebrows.
- Never put a single word of a heading in a different color or style.
- Numbers in readouts use the mono font with `min-width` so they don't jump while dragging, and a real minus sign (−).

## Spacing

Use a 4px scale (0.25rem steps) and Starlight's layout utilities (`sl-flex`, `sl-hidden`, `md:sl-flex`). There is no utility-class framework: component styles live in scoped Astro `<style>` blocks or `src/styles/components.css`. Vertical rhythm on paper is based on the body line height: 0.75em between paragraphs, 2.5em above h2.

## Large screens

On screens wider than 1920px the root font size grows, from 100% at 1920px to 150% at 3840px and no further, so text, the column, the sidebars and the boards grow together on 4K monitors and TVs ([decision 0025](../decisions/0025-large-screen-scaling.md)). Phones, laptops and 1920px screens are unchanged, and browser zoom still enlarges text.

- Size things in rem, so they follow. 1rem is 16px at the base size; convert exactly (399px is 24.9375rem).
- Px stay px only for 1px hairlines, border radii, outline widths and offsets, focus halos and the 44px minimum tap target.
- Container queries in rem measure against the initial font size, so a board's breakpoints don't move as the root grows.
- Mafs boards multiply every px they pass to Mafs by `useBoardScale()` ([math-plots-code.md](math-plots-code.md#plots-mafs-boards)).

## Focus

A two-tone focus ring works on every surface: a 2px ink outline plus a 3px yellow halo (`--ms-attention-fill`). On light paper the ink outline does the work, and the yellow is a halo, never a thin line on white.

## Motion

- Motion answers an action: dragging, opening, confirming. No entrance animations.
- Respect `prefers-reduced-motion`: disable transitions and animated values.
- Page transitions use the native `@view-transition` rule, so browsers without support simply navigate.

## Shape

- Corner radius 4px for boards, code blocks and controls. No pills.
- No drop shadows and no gradients.
- No full-height vertical dividers between columns, and no colored or hairline bars on the left of content blocks. Use whitespace, a label or the sunk surface instead (decision 0006).
- Horizontal rules only between list items and under the header ledge.
