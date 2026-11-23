# MathSignal

**Interactive math for machine learning, from first intuition to research.**

[![Checks](https://github.com/MHuzaifaHussain/MathSignal/actions/workflows/checks.yml/badge.svg)](https://github.com/MHuzaifaHussain/MathSignal/actions/workflows/checks.yml)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)
[![Text: CC BY 4.0](https://img.shields.io/badge/text-CC%20BY%204.0-lightgrey)](LICENSE-CONTENT.md)

[MathSignal](https://mathsignal.dev/) explains the statistics, probability and linear algebra behind machine learning. Every concept page lets you move the math on a live plot, then builds from an everyday picture to the exact definition, worked examples, machine-learning applications, runnable Python and the current research, with every source cited.

## Contents

- [Who it is for](#who-it-is-for)
- [What a concept page contains](#what-a-concept-page-contains)
- [Subjects](#subjects)
- [Technology](#technology)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Quality checks](#quality-checks)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Reporting an error](#reporting-an-error)
- [License](#license)

## Who it is for

Students, engineers and machine-learning practitioners who want to understand the math they use, and researchers who want a precise statement and the literature in one place. Each page has a main path that reads on its own; "Simpler" sections add a gentler route and "Go deeper" sections add derivations and edge cases, so a beginner and an expert can use the same page.

## What a concept page contains

| Part | What you get |
|---|---|
| Everyday picture | An analogy, and where that analogy stops being true |
| Interactive board | A plot or sample space you can change, introduced by a prediction question |
| Explanation | The idea in plain language, one question per section |
| Notation and precise statement | Every symbol named, then the exact definition with its conditions |
| Formal definition | Derivations and properties, collapsed until you want them |
| Worked examples | Graded from easy to harder, the last one for you to try |
| Machine learning | Where the concept appears in practice, with the papers it comes from |
| Code | Python that runs in your browser and checks its own results |
| Research frontier | Open questions and recent results, with the date they were last checked |
| Self-check and common mistakes | Questions with explained answers, and the misconceptions to avoid |
| References | Every source, opened and checked before it is cited |

The [Normal distribution](https://mathsignal.dev/statistics/normal-distribution/) page is the reference example.

## Subjects

| Subject | Status |
|---|---|
| Statistics | Live: [Normal distribution](https://mathsignal.dev/statistics/normal-distribution/) |
| Probability | In progress: sample spaces and events, the probability axioms, conditional probability |
| Linear algebra | Planned |
| Machine learning | Planned |

## Technology

| Area | Choice |
|---|---|
| Site | [Astro](https://astro.build) 7 and [Starlight](https://starlight.astro.build): a static site with search (Pagefind) |
| Interactivity | [React](https://react.dev) 19 islands, loaded only when they scroll into view |
| Plots | [Mafs](https://mafs.dev) for continuous plots; accessible HTML tables for discrete sample spaces |
| Controls | [Base UI](https://base-ui.com) sliders and native form controls |
| Math | [KaTeX](https://katex.org) through `remark-math` and `rehype-katex`, rendered at build time |
| Code | [Expressive Code](https://expressive-code.com) with themes generated from the site palette |
| Runnable Python | [Pyodide](https://pyodide.org) in a Web Worker |
| Styling | Design tokens generated from one palette file; no CSS framework |
| Hosting | Cloudflare Pages |

Design goals: WCAG 2.2 AA accessibility, full light and dark themes that follow the reader's system setting, no tracking cookies, and pages that stay readable without JavaScript.

## Getting started

Requirements: [Node.js](https://nodejs.org) 24 (the exact version is pinned in `.nvmrc`).

```bash
git clone https://github.com/MHuzaifaHussain/MathSignal.git
cd MathSignal
npm install
npm run dev
```

The development server runs at http://localhost:4321.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Runs the quality checks and builds the static site into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm run check` | Type-checks `.astro`, `.ts` and `.tsx` files |
| `npm run check:design` | Checks color contrast and color-blindness rules, and that generated files are up to date |
| `npm run check:content` | Checks the topic, notation and reference registries, page metadata, SEO rules and spelling |
| `npm run check:boards` | Checks the interactive boards' math, wording and state rules |
| `npm run check:links` | Checks every internal link and anchor in the built site |
| `npm run check:code` | Runs every runnable Python example and checks its assertions |
| `npm run tokens` | Regenerates the CSS tokens, favicon, logos and web manifest from `src/design/palette.mjs` |
| `npm run brand-images` | Regenerates the social card and app icons |

## Quality checks

A page cannot be published with a broken formula, link or example. `npm run build` stops if any of these fail:

- **Design:** every color pairing meets its contrast rule in both themes, and meaning colors stay distinguishable under color blindness.
- **Content:** every topic, symbol and reference a page uses exists; descriptions are 120–160 characters; titles, descriptions and primary search phrases are unique; drafts are never linked as published.
- **Math:** every formula renders; a KaTeX error fails the build.
- **Boards:** the probability boards' arithmetic, sentences and rules are asserted before every build.
- **Links:** every internal link and `#anchor` in the built site resolves, with exact letter case.

GitHub Actions runs the type-check, the full build and the Python examples on every push and pull request.

## Project structure

```
src/
  content/docs/      Pages (MDX), one folder per subject
  components/        Page components (Astro) and interactive boards (React)
  data/              Topic, notation and reference registries
  design/            Palette, subjects, KaTeX settings, code themes
  styles/            Generated tokens, global and component styles
scripts/             Token generation and the quality checks
docs/
  design-system/     Colors, type, components, math, plots, accessibility, page template
  decisions/         Records of the major design and technical decisions
  seo/               Search guidelines
public/              Static files: icons, social card, robots.txt, headers
```

## Documentation

- [Design system](docs/design-system/README.md): colors, typography, components, math, plots, code and accessibility
- [Writing a concept page](docs/design-system/writing-a-concept-page.md): the page template, metadata and pre-publish checklist
- [Decision records](docs/decisions/README.md): why the major choices were made
- [SEO guidelines](docs/seo/README.md): writing for the learner first
- [Deployment](DEPLOY.md): Cloudflare Pages settings and post-deploy checks

## Deployment

Cloudflare Pages builds and deploys `main` to [mathsignal.dev](https://mathsignal.dev/) on every push; other branches get preview deployments. Response headers live in `public/_headers`. See [DEPLOY.md](DEPLOY.md).

## Reporting an error

Every page has a "Report an error on this page" link at the bottom that opens a prefilled issue. You can also [open an issue](https://github.com/MHuzaifaHussain/MathSignal/issues) directly.

## License

Written by Muhammad Huzaifa Hussain.

- Text and documentation: [Creative Commons Attribution 4.0](LICENSE-CONTENT.md)
- Code: [MIT](LICENSE)
