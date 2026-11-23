# 0009: Single sources of truth for topics, notation and references

Status: accepted, 2026-11-23

## Context
At 14–21 pages a week, facts repeated across pages drift: a prerequisite's recap written five times says five slightly different things, a symbol gets two conventions, a paper is cited with three spellings, and a "next topic" link points at a page that was renamed. The colour system already avoids this with one palette file and a build check.

## Decision
Shared facts live in one registry each, under `src/data/`, and pages refer to them by id:

| Registry | Holds | Used by |
|---|---|---|
| `topics.mjs` | Every topic (published or planned): title, one-line description, two-line recap, prerequisites, what it leads to | `ConceptHeader` (prerequisites with recaps), `ConceptMap` |
| `notation.mjs` | Every symbol: TeX, how to say it, meaning, convention notes | `NotationKey` |
| `references.mjs` | Every cited source: authors, year, title, venue, link, the date it was opened and checked | `Cite`, `References`, `ResearchFrontier` |

Concept pages also carry structured frontmatter (`src/content.config.ts`): `topic`, `type`, `objectives`, `takeaways`, `references`, `author`, `reviewedAt`, `aiAssisted`, `primaryQuery`, `searchIntent`, `depthStatus`.

Checks:
- `npm run check:content` (runs before every build) fails on an unknown topic, symbol or reference id, a missing required frontmatter field on a concept page, a prerequisite cycle, or a reference with no `checked` date.
- `npm run check:code` runs every `PyRunner` example under the same Pyodide version the site loads and fails if any assertion fails. It downloads Pyodide packages, so it runs in CI and on demand rather than before every local build.

## Consequences
- Writing a page starts by adding its topic, symbols and sources to the registries.
- Components fail the build loudly on an unknown id instead of rendering an empty or wrong block.
- A reference is added only after it has been opened; `checked` records when.
