# 0007: No KaTeX in board islands

Status: accepted, 2026-11-23

## Context
Mafs imports KaTeX at module level for its `<LaTeX>` component. No board uses `<LaTeX>`: plot labels use Mafs `<Text>`, and every formula on a page is rendered at build time by rehype-katex. Even so, the whole KaTeX library shipped inside every board's JavaScript.

Measured on the Normal distribution board: 97 KB gzip (320 KB raw) with KaTeX, 31 KB gzip (92 KB raw) without. That is 66 KB less to download and parse on every page with a board, which matters most on phones.

## Decision
Inside Vite, the bare `katex` import resolves to `src/components/react/katex-stub.ts`, a stub that throws a clear error if anything calls it. The alias is an exact match (`/^katex$/`), so `katex/dist/katex.min.css` still resolves to the real package. rehype-katex runs in the Markdown pipeline and imports the real KaTeX from Node, so page formulas are unaffected.

## Consequences
- Boards must not use Mafs `<LaTeX>`. Use `<Text>` for labels, and put formulas in the page's MDX. If `<LaTeX>` is ever used, the stub throws loudly rather than failing silently.
- If a future island genuinely needs client-side KaTeX, revisit this record: remove the alias or scope it more narrowly.
- The alias lives in `astro.config.mjs` (`vite.resolve.alias`). A Vite plugin `resolveId` hook was tried first and does not see this import under Vite 8, so don't "simplify" back to that.
