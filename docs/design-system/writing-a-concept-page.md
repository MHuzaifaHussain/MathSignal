# Writing a concept page

Every concept page follows the same order, so readers always know where to look.

1. `ConceptHeader`: level, one-liner, prerequisites
2. `WhyThisMatters`: the ML relevance, in one or two paragraphs
3. `## Interactive visualisation`: one `Board`, with a sentence telling the reader what to try
4. Explanation sections (`##`), with `SideNote`s for asides
5. `FormalDefinition`: the formal maths, using `\vmu` / `\vsigma`
6. `## In practice: machine learning applications`
7. `## Code implementation`: fenced blocks or a `PyRunner`
8. `CommonMistakes` with `Mistake` pairs
9. `NextTopics`

## Skeleton

```mdx
---
title: Normal distribution
description: The bell curve, its two parameters, and why it shows up everywhere in ML.
---
import ConceptHeader from '../../../components/ConceptHeader.astro';
import WhyThisMatters from '../../../components/WhyThisMatters.astro';
import FormalDefinition from '../../../components/FormalDefinition.astro';
import CommonMistakes from '../../../components/CommonMistakes.astro';
import Mistake from '../../../components/Mistake.astro';
import NextTopics from '../../../components/NextTopics.astro';
import Var from '../../../components/Var.astro';
import NormalDistribution from '../../../components/react/NormalDistribution.tsx';

<ConceptHeader difficulty="beginner" oneLiner="..." />

<WhyThisMatters>...</WhyThisMatters>

## Interactive visualisation

Drag the pink dot to move the mean <Var name="mu" />; drag the blue dot to change the spread <Var name="sigma" />.

<div class="not-content">
  <NormalDistribution client:visible />
</div>
```

## Checklist

- [ ] Sections are in the order above; no `<h1>` in the page body.
- [ ] μ and σ use `\vmu` / `\vsigma` in formulas and `<Var>` in prose; nothing else is coloured.
- [ ] At most two boards; each has a tray alternative for every handle.
- [ ] Handwritten notes are qualitative and short.
- [ ] Teaching code names its variables `mu` and `sigma` so the code markers apply.
- [ ] Internal links are relative paths like `/statistics/normal-distribution/`.
- [ ] `npm run build` passes (it runs the design check first).
- [ ] Checked in both themes, on a phone width, and with the keyboard.
