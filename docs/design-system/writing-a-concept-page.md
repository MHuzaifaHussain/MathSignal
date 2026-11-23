# Writing a concept page

Every concept page follows the same order, so readers always know where to look. Each page has to work for a curious beginner and for a researcher at once: the early sections assume nothing, the later ones are exact and cited. [`src/content/docs/statistics/normal-distribution.mdx`](../../src/content/docs/statistics/normal-distribution.mdx) is the reference page.

1. `ConceptHeader`: level, a one-line definition that names the concept ("The normal distribution is…"), prerequisites
2. `## In everyday terms`: 150–300 words for a complete beginner. One everyday picture, a second picture that covers the first one's blind spot, and a bold **Where this picture breaks.** paragraph. Plain prose, no box.
3. `WhyThisMatters`: the ML relevance, in one paragraph, no hype
4. `## Interactive visualisation`: a prediction question **before** the board ("if σ doubles, what happens to the peak?"), the drag instructions and a goal, then the `Board`, then the answer
5. Explanation sections (`##`), each opening with a sentence that answers its heading; `SideNote`s for asides
6. `## Notation`: a symbol table (Symbol, Say it, Meaning) and an always-visible **Precise statement.** paragraph with the exact definition and conditions
7. `FormalDefinition`: derivations and proof sketches (numbered steps, labelled "sketch"), properties table
8. `## Worked examples`: three, graded from easy to harder; the last is "Your turn" with the answer in brackets
9. `## In practice: machine learning applications`: each application with its equation, and plain quantities (not `\vmu`) when the symbol means something else
10. `## Code implementation`: a `PyRunner` with a fixed seed and `assert`s, then any display-only blocks (seeded)
11. `## Check yourself`: two to four questions in `<details>`, each answer explaining why
12. `## Common mistakes` heading, then `CommonMistakes` with `Mistake` pairs specific to the topic
13. `## Where to go next` heading, then `NextTopics` (unwritten pages without `href`, so they show as coming soon)
14. `## References`: real, checked sources with links (arXiv, DOI, publisher). Never cite a paper you haven't opened.

The planned blueprint components (notation key, step-through derivations, check-yourself quizzes, depth folds) will replace the markdown versions of sections 6–11 once they exist; until then, write them in plain MDX as above.

## Skeleton

```mdx
---
title: Normal distribution
description: 120–160 characters, human-written, saying what the reader can do on the page.
---
import ConceptHeader from '../../../components/ConceptHeader.astro';
import WhyThisMatters from '../../../components/WhyThisMatters.astro';
import FormalDefinition from '../../../components/FormalDefinition.astro';
import CommonMistakes from '../../../components/CommonMistakes.astro';
import Mistake from '../../../components/Mistake.astro';
import NextTopics from '../../../components/NextTopics.astro';
import Var from '../../../components/Var.astro';
import NormalDistribution from '../../../components/react/NormalDistribution.tsx';

<ConceptHeader difficulty="beginner" oneLiner="The normal distribution is …" />

## In everyday terms

…

**Where this picture breaks.** …

<WhyThisMatters>…</WhyThisMatters>

## Interactive visualisation

Before you touch anything: if <Var name="sigma" /> doubles, what happens to the peak?

<div class="not-content">
  <NormalDistribution client:visible />
</div>

The peak halves, because …
```

## Writing style

- British spelling, sentence case, plain words. No hype ("the single most important", "surprisingly", "extremely").
- At most one em dash per page.
- Every claim that could be wrong is checked: run the code, recompute the numbers, open the paper.
- SEO follows [docs/seo/README.md](../seo/README.md): write for the reader first; the concept's name appears naturally in the title, description, first sentence and at most one heading.

## Checklist

- [ ] Sections are in the order above; no `<h1>` in the page body.
- [ ] The everyday section has a "Where this picture breaks" paragraph.
- [ ] The board is introduced by a prediction question and followed by the answer.
- [ ] μ and σ use `\vmu` / `\vsigma` in formulas and `<Var>` in prose; nothing else is coloured.
- [ ] At most two boards; each has a tray alternative for every handle.
- [ ] Handwritten notes are qualitative, short and don't give away the prediction.
- [ ] Teaching code names its variables `mu` and `sigma`, sets a seed, and asserts its results.
- [ ] Every reference is real and links to the source.
- [ ] Internal links are relative paths with a trailing slash, like `/statistics/normal-distribution/`.
- [ ] `npm run build` and `npm run check` pass.
- [ ] Checked in both themes, on a phone width, and with the keyboard.
