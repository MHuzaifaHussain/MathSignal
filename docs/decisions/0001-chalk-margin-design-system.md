# 0001: Chalk Margin design system

Status: accepted, 2026-11-23

## Context
The first version used Starlight's defaults with a cyan accent and coloured pills. It looked generic and gave colour no meaning. MathSignal pages mix long reading, formulas, interactive plots and code, and need one visual language across all four.

## Decision
Adopt "Chalk Margin": paper for reading, a board for every interactive plot, a margin for side notes. Colour is reserved for meaning: μ pink, σ blue, "look here" yellow/ochre. Literata for reading, Atkinson Hyperlegible Next for interface, Atkinson Hyperlegible Mono for code, Kalam handwriting only on boards. Colours live in one file (`src/design/palette.mjs`) and a check script enforces contrast and colour-blindness rules on every build.

## Consequences
- A reader learns the μ/σ colours once and they hold everywhere, including code.
- New variables are written in ink unless a meaning role is deliberately added.
- Five font families load; Latin subsets only, Kalam loaded only with boards.

## Alternatives considered
- "Graph paper" (calm, light, margin notes) and "Lecture hall" (dark chalkboard everywhere). Chalk Margin keeps the lecture-hall board and the graph-paper reading experience.
