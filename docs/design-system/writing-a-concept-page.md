# Writing a concept page

Every concept page follows the same order, so readers always know where to look. Each page has to work for a curious beginner and for a researcher at once ([decision 0008](../decisions/0008-spine-and-folds-article-template.md)): the **spine** reads completely on its own, `Simpler` folds add a gentler route, and `GoDeeper` folds add rigor. [`src/content/docs/statistics/normal-distribution.mdx`](../../src/content/docs/statistics/normal-distribution.mdx) is the reference page; copy its structure.

Headings are **topic-specific** ("Move the bell yourself", "Where the normal distribution shows up in ML"), not generic labels, so the outline tells the reader what they will learn. The order is fixed; the wording is yours. Only "Notation", "Worked examples", "Research frontier", "Check yourself", "Common mistakes", "Key takeaways", "How this connects" and "References" stay as they are, so returning readers can find them.

1. `ConceptHeader`: level, a one-line definition that names the concept ("The normal distribution is…"). Prerequisites and objectives come from the registry and frontmatter.
2. Everyday section (`## In everyday terms`): `Analogy`, 150–300 words for a complete beginner. One everyday picture, a second that covers the first one's blind spot, and the required `breaks` text.
3. `WhyThisMatters`: the ML relevance, in one paragraph, no hype.
4. Board section: a prediction question **before** the board, the drag instructions and a goal, then the `Board`, then the answer.
5. Explanation sections (`##` and `###`), each opening with a sentence that answers its heading. `Simpler` and `GoDeeper` folds where they add something new; `SideNote`s for asides.
6. `## Notation`: `NotationKey` with the page's symbols, then `PreciseStatement` with the exact definition, conditions and boundary cases.
7. `FormalDefinition`: `StepThrough` derivations and a properties table.
8. `## Worked examples`: three `WorkedExample`s graded from easy to harder; the last is `faded`, with its solution in `<div slot="solution">`.
9. ML section: each application with its equation and a `Cite` for the paper it comes from. Use plain quantities (not `\vmu`) when the symbol means something else.
10. Code section: a `PyRunner` with a fixed seed and `assert`s (run by `npm run check:code`), then any display-only blocks, also seeded.
11. `## Research frontier`: `ResearchFrontier` with the date you checked it. Two or three open questions or recent results, each cited. Say what is unsettled.
12. `## Check yourself`: two to four `CheckYourself` questions across the levels (`intuition`, `standard`, `proof`). Each answer explains why.
13. `## Common mistakes`, then `CommonMistakes` with `Mistake` pairs specific to the topic.
14. `## Key takeaways`, then `Takeaways`.
15. `## How this connects`, then `ConceptMap`.
16. `## References`, then `References`. Real, checked sources only. Never cite a paper you haven't opened.

## Frontmatter

Concept pages (any page inside a subject) must set these fields; the build stops if one is missing or `topic` doesn't match the page's path.

| Field | Meaning |
|---|---|
| `topic` | Id in `src/data/topics.mjs`, equal to the page path (`statistics/normal-distribution`). Add the topic there first |
| `type` | A: concept page that introduces a new board. B: concept page on an existing board. C: worked walkthrough of one skill. D: "X vs Y" comparison. E: ML deep dive. F: hub or cheat sheet |
| `objectives` | Three to five things the reader will be able to do, starting with a verb |
| `takeaways` | Three to five sentences that stand on their own |
| `references` | Ids from `src/data/references.mjs`. Every `<Cite id>` must be listed here |
| `author`, `reviewedAt` | Who wrote it and when it was last checked (YYYY-MM-DD). Shown in the footer and JSON-LD |
| `aiAssisted` | `true` if an AI assistant helped draft it |
| `primaryQuery`, `searchIntent` | The plain search phrase the page answers ([SEO guide](../seo/README.md)), and the intent that follows from the type: `learn` (A, B), `solve` (C), `compare` (D), `apply` (E) or `reference` (F) |
| `depthStatus` | `spine` while only the spine is written, `complete` once folds, frontier and checks are in |

Add new symbols to `src/data/notation.mjs` and new sources to `src/data/references.mjs` (with the date you opened them). `npm run check:content` checks every id before the build ([decision 0009](../decisions/0009-single-sources-of-truth.md)).

## Releasing a page

Merge a finished page with `draft: true` in its frontmatter and its topic still `status: 'planned'` in `src/data/topics.mjs`. Starlight leaves drafts out of production builds, search, the sitemap and `llms.txt`, and other pages show the topic as "coming soon". To release it, remove `draft: true` and set the topic to `'published'` in the same commit. `npm run check:content` fails if the two disagree.

## Skeleton

```mdx
---
title: Normal distribution
description: 120–160 characters, human-written, saying what the reader can do on the page.
topic: statistics/normal-distribution
type: A
objectives:
  - Describe a normal distribution by its mean and standard deviation.
  - …
takeaways:
  - Two numbers set the whole bell.
  - …
references:
  - he2015
author: Your Name
reviewedAt: 2026-11-23
aiAssisted: false
primaryQuery: normal distribution
searchIntent: learn
depthStatus: spine
---
import Analogy from '../../../components/Analogy.astro';
import ConceptHeader from '../../../components/ConceptHeader.astro';
import WhyThisMatters from '../../../components/WhyThisMatters.astro';
import Var from '../../../components/Var.astro';
import NormalDistribution from '../../../components/react/NormalDistribution.tsx';
{/* …and the other components the page uses */}

<ConceptHeader difficulty="beginner" oneLiner="The normal distribution is …" />

## In everyday terms

<Analogy breaks="Heights can never be negative, yet the bell's tails never end …">
…
</Analogy>

<WhyThisMatters>…</WhyThisMatters>

## Move the bell yourself

Before you touch anything: if <Var name="sigma" /> doubles, what happens to the peak?

<div class="not-content">
  <NormalDistribution client:visible />
</div>

The peak halves, because …

## Notation

<NotationKey symbols={["mu", "sigma"]} />

<PreciseStatement>…</PreciseStatement>

…

## Key takeaways

<Takeaways />

## How this connects

<ConceptMap />

## References

<References />
```

## Writing style

- American spelling ([decision 0010](../decisions/0010-american-english.md)): math, initialization, color, center, toward. Sentence case, plain words. No hype ("the single most important", "surprisingly", "extremely").
- At most one em dash per page.
- Every claim that could be wrong is checked: run the code, recompute the numbers, open the paper.
- SEO follows [docs/seo/README.md](../seo/README.md): write for the reader first; the concept's name appears naturally in the title, description, first sentence and at most one heading.

**Length.** The word limits count reader prose only: the words in the spine and the folds, including the CheckYourself questions, the one-liner, the analogy's `breaks` and each mistake's `wrong` text. Code, tables, the reference list, CheckYourself answers, frontmatter, imports and tags are left out, and each formula counts as one word. `npm run check:content` counts every concept page with one shared counter (`countReaderWords` in `scripts/check-content.mjs`), prints the counts, and fails a `complete` page outside its type's range: A and B 1,500–3,000 words, C, D and E 1,200–2,500, F at most 2,500. Pages written before the counter are listed in its `WORD_COUNT_EXCEPTIONS` with their measured count and only warn.

## Checklist

- [ ] Sections are in the order above, with topic-specific headings; no `<h1>` in the page body.
- [ ] Frontmatter is complete and the topic, symbols and references exist in `src/data/`.
- [ ] `sidebar.order` puts the page after its prerequisites in its subject (otherwise Starlight sorts alphabetically).
- [ ] Every fold adds something the spine doesn't say; the page reads fully with every fold closed.
- [ ] The board is introduced by a prediction question and followed by the answer.
- [ ] μ and σ use `\vmu` / `\vsigma` in formulas and `<Var>` in prose; nothing else is colored.
- [ ] At most two boards; each has a tray alternative for every handle.
- [ ] Handwritten notes are qualitative, short and don't give away the prediction.
- [ ] Teaching code names its variables `mu` and `sigma`, sets a seed, and asserts its results.
- [ ] Every reference is real and links to the source.
- [ ] Internal links are relative paths with a trailing slash, like `/statistics/normal-distribution/`.
- [ ] `npm run build`, `npm run check` and `npm run check:code` pass.
- [ ] Checked in both themes, on a phone width, and with the keyboard.
