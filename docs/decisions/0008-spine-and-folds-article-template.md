# 0008: Spine and folds article template

Status: accepted, 2026-11-23

## Context
MathSignal pages must work for a complete beginner and for a researcher at the same time. One fixed text fails both (the expertise-reversal effect): detail a researcher needs overloads a beginner, and scaffolding a beginner needs slows a researcher down. The 12-week plan's blueprint compared three architectures (a depth ladder, a spine with folds, and separate pages per level) and chose the spine with folds.

## Decision
Every concept page has a **spine** that reads completely on its own, plus optional **folds**:

- **Simpler** folds add a new picture, analogy or set of numbers for a beginner. **Go deeper** folds add derivations, edge cases and generalisations. A fold that only repeats the spine is cut.
- Folds are `<details>` elements built on one shared primitive (`Fold`), closed by default, with a plain label. They never contain headings, so the outline stays clean. A fold opens when its id is in the URL, so links can point into it.
- The page order and the required layers are in [writing-a-concept-page.md](../design-system/writing-a-concept-page.md): everyday picture with "where this breaks", predict-then-drag board, notation key, always-visible precise statement, spine sections, formal definition with step-through derivations, worked examples, ML applications, verified code, research frontier, checks at three levels, common mistakes, takeaways, concept map, references.
- Section headings are **topic-specific** ("Move the bell yourself", "Where the normal distribution shows up in ML") rather than fixed role names; the order of roles stays the same.
- An **expert skip line** in the header links straight to the precise statement, the formal definition, the research frontier and the references.

Deferred: a reader-depth switch that opens or closes all folds at once, and the guided board features (presets, wrong-model overlay, concreteness stages). They will get their own records when built.

## Consequences
- New components: `Fold`, `Simpler`, `GoDeeper`, `NotationKey`, `PreciseStatement`, `LearningObjectives`, `Takeaways`, `Analogy`, `StepThrough`, `WorkedExample`, `CheckYourself`, `ConceptMap`, `Cite`, `References`, `ResearchFrontier`. They follow decision 0006: no left bars, no shadows, no cards.
- Pages take longer to write. Article types with less depth (worked examples, comparisons) use a subset of the layers, as the plan's §4 sets out.
