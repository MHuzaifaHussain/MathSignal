# 0006: No decorative vertical rules, bars or shadows

Status: accepted, 2026-11-23

## Context
A design audit of the published pages found the patterns that make a site read as templated or AI-generated: full-height hairlines framing the sidebar and the table of contents, guide lines in nested sidebar lists, coloured left bars on callouts ("Why this matters", side notes, `<details>` blocks), an accent bar on the current sidebar item, a vertical divider in the header, a rule between code line numbers and code, drop shadows on Starlight's pagination and dialogs, and an off-palette favicon. Design-system rule 5 already said "no decoration without information", but these came from Starlight defaults and from our own components.

## Decision
- Columns are separated by whitespace. `--ms-rule` is never a full-height vertical divider.
- Content blocks are set apart by a label, spacing or a surface (the sunk band), never by a decorative vertical bar.
- No drop shadows anywhere (`--sl-shadow-*` are `none`).
- The current sidebar item is shown by a fill and a heavier weight, not a bar.
- Disclosure blocks (`<details>`, `FormalDefinition`) use the triangle and a label; `FormalDefinition` is a sunk band with no outline, rounded corners or inner rule.
- Previous/next links are a quiet text footer, kept within the active subject.
- The favicon and logos are generated from `src/design/palette.mjs`, so the brand can't drift off-palette.

**One exception:** highlighted lines in dark-mode code keep a thin yellow edge. A visible background band would push dark token colours below the 5.5:1 contrast floor, so the edge is the only cue that a line is highlighted. It is functional, not decorative. Light mode uses a band and no edge.

## Consequences
- Overrides live in `src/styles/global.css` (unlayered, so they beat Starlight's layered defaults). Recheck them on Starlight upgrades, along with the Header and Sidebar overrides.
- New components must not introduce left bars or shadows. The concept-page checklist and the design-system README say so.
- Horizontal rules remain allowed where they separate list items or mark the header ledge.
