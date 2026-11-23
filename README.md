# MathSignal

[MathSignal](https://mathsignal.dev/) teaches the maths behind machine learning through interactive pages. Each concept starts with an everyday picture, lets you drag the maths on a plot, then works up to the formal definition, its uses in ML, runnable code and current research.

Pages are written for a complete beginner and a researcher at the same time. The main text reads on its own; "Simpler" and "Go deeper" folds add a gentler route or the full rigour.

## Subjects

| Subject | Status |
|---|---|
| Statistics | Live: [Normal distribution](https://mathsignal.dev/statistics/normal-distribution/) |
| Probability | Coming soon |
| Linear algebra | Coming soon |
| Machine learning | Coming soon |

## Stack

- [Astro](https://astro.build) 7 and [Starlight](https://starlight.astro.build): static site, sidebar, search (Pagefind)
- [React](https://react.dev) 19 islands with [Mafs](https://mafs.dev) for draggable plots and [Base UI](https://base-ui.com) sliders
- [KaTeX](https://katex.org) through `remark-math` and `rehype-katex`, rendered at build time
- [Expressive Code](https://expressive-code.com) for code blocks, with themes generated from the palette
- [Pyodide](https://pyodide.org) in a Web Worker for Python that runs in the browser
- Design tokens generated from one palette file; no CSS framework

## Local development

Requires Node 24 (see `.nvmrc`).

```bash
npm install
npm run dev       # dev server at http://localhost:4321
npm run build     # static build to ./dist (design and content checks before, link check after)
npm run preview   # serve the build locally
```

| Command | What it does |
|---|---|
| `npm run check` | Type-checks `.astro`, `.ts` and `.tsx` files |
| `npm run check:design` | Contrast and colour-blindness rules; generated tokens, favicon and logos up to date |
| `npm run check:content` | Topic, notation and reference registries, and the ids each page uses |
| `npm run check:code` | Runs every runnable Python example under Pyodide and checks its assertions |
| `npm run check:links` | Checks every internal link and anchor in the built site |
| `npm run tokens` | Regenerates the CSS tokens, favicon, logos and web manifest from `src/design/palette.mjs` |
| `npm run brand-images` | Regenerates the social card and app icons (PNG) |

## Contributing

Start with [AGENTS.md](AGENTS.md). It links to everything else:

- [Design system](docs/design-system/README.md): colours, type, components, maths, plots and code
- [Writing a concept page](docs/design-system/writing-a-concept-page.md): the page template, frontmatter and checklist
- [Decision records](docs/decisions/README.md): why the big choices were made
- [SEO guide](docs/seo/README.md): write for the learner first
- [AI assistant skills](docs/tooling/agent-skills.md): recommended skills and tools for coding agents
- [Deployment](DEPLOY.md): Cloudflare Pages settings

Found a mistake on a page? Use the "Report an error on this page" link at the bottom of it, or [open an issue](https://github.com/MHuzaifaHussain/MathSignal/issues).

## Licence

Written by Muhammad Huzaifa Hussain. The text and documentation are licensed under [CC BY 4.0](LICENSE-CONTENT.md); the code is licensed under [MIT](LICENSE).
