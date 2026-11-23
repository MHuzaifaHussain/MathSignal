# 0004: Stay on Astro and Starlight, upgrade to Astro 7

Status: accepted, 2026-11-23

## Context
The site ran Astro 6.0.7 and Starlight 0.38. Dev mode failed to serve Expressive Code's stylesheet because Astro 6 (Vite 7) was mixed with Vite 8 from `@vitejs/plugin-react`. Alternatives considered: Fumadocs, Docusaurus, VitePress, Nextra, Mintlify.

## Decision
Stay on Astro + Starlight and upgrade to Astro 7, Starlight 0.43 and `@astrojs/react` 7. Only Astro hydrates individual widgets while keeping prose and KaTeX fully static, which is exactly this site's shape.

Upgrade notes:
- Astro 7 renders Markdown with Sätteri by default, which turns `$$` display maths into a code block without an error. Use `markdown.processor: unified()` with `remark-math` and `rehype-katex`.
- Node 22.23.4 or newer.
- Tailwind moves to `@tailwindcss/vite` (the Vite 7/8 clash that ruled it out is gone), with the CSS layer order `base, starlight, theme, components, utilities`. (Superseded: Tailwind was later removed, see [0005](0005-remove-tailwind.md).)
- KaTeX stays on 0.16.x for now; moving to 0.19 is a separate change. (Done 2026-11-23: KaTeX 0.19.1, forced on rehype-katex, Mafs and micromark-extension-math through an npm `overrides` entry because they still declare `^0.16`. 0.18 prefixed KaTeX's internal CSS classes; the root `.katex` class and `\htmlClass` classes are unchanged, so no project CSS needed updating.)

## Consequences
- Starlight overrides (Header, Sidebar) must be rechecked on every Starlight upgrade.
- Additions follow when pages need them: Pyodide for runnable Python, Base UI for tray controls, react-three-fiber for 3D, Observable Plot for histograms.
