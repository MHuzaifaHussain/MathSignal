# 0024: Wide tables and formulas scroll in focusable, named boxes

Status: accepted, 2026-11-26. Answers the site-wide table question that [0023](0023-page-footer-and-properties-table.md) left open.

## Context
Starlight turns every markdown table into a block that scrolls sideways when it is wider than the column, and `global.css` does the same for display formulas (`.katex-display`). NotationKey is a markdown-styled table too. None of these boxes could take focus or had a name, so in a browser that doesn't make scroll boxes focusable on its own (Safari), a keyboard reader could not reach a table's last columns or the end of a formula, and a screen reader landed on an unnamed element where one did. The browser pass on the week-two branch found this on every page, at 320 and 375px and, for a few wide tables and formulas, at 1280px. `accessibility.md` already asked for a focusable, named region around any table that can be wider than its column; only PropertiesTable had one.

## Decision
- **Fit first.** A display formula wider than the 632px desktop column is split into lines (`gathered`, `aligned` or separate `$$` blocks), and an inline list of formulas is written as separate inline formulas so the line can wrap after each comma. A table wider than the desktop column is narrowed where a small edit does it: shorter code cells, or a wide row of numbers transposed into two columns. The cheat sheet's code-heavy tables stay wide; they scroll in the focusable box below.
- **Focusable only while it overflows.** `src/components/scrollBoxes/focusableScrollBoxes.ts`, loaded once per page by the footer override, watches every content table outside `.not-content` (markdown tables and NotationKey) and every `.katex-display`. While a box is wider than its column it gets `tabindex="0"` and a name; when it fits again, the script removes exactly what it added. Expressive Code does the same for code blocks. A table that fits adds no tab stop, so a page of short formulas doesn't gain dozens.
- **Names.** A table is named by its column headers ("Mean, Median, Mode, scrolls sideways"), so two wide tables on a page are told apart. It keeps its table role, which the screen reader says after the name, so the name never says "Table". When another table on the page has the same headers, the nearest heading above leads the name ("Rules for one event: Rule, Formula, …, scrolls sideways"). A table with no header text and no heading is "Scrolls sideways". NotationKey is named "Notation". A formula gets `role="group"` and the name "Formula, scrolls sideways"; a group is not a landmark, so the shared name doesn't trip landmark uniqueness. The names live in `src/components/scrollBoxes/labels.ts`, pinned by `npm run check:boards`.
- **Long notation symbols wrap.** A notation entry with `wraps: true` (the pre-image, the fences, set-builder notation and the other long ones) may break after its relations; every other symbol stays on one line.
- PropertiesTable keeps its static region: its caption names it, and it is in `.not-content`, so the script skips it.

## Consequences
- The focus ring shows on a focused box with the site's usual outline and halo. Print is unchanged: nothing here clips on paper.
- Without JavaScript the boxes still scroll but aren't focusable, which is where they were before.
- A new wide table or formula needs nothing extra for the keyboard, but the fit-first rule means a writer checks it at 1280px.

## Alternatives considered
- A static `tabindex="0"` region around every table and formula (PropertiesTable's pattern): one tab stop per formula even when it fits, and a markdown table would have to leave Starlight's table rule to be wrapped.
- A rehype step adding the attributes at build time: it can't know which boxes overflow at the reader's width.
- Captions on every markdown table: visible text on 30-odd tables, for a name only a screen reader needs.
- Relying on Chromium making scroll boxes focusable: Safari doesn't, and the box would still be unnamed.
