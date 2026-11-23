# 0010: American English

Status: accepted, 2026-11-23

## Context
The site was written in British English ("maths", "initialisation", "colour"), but the brand and domain are MathSignal and mathsignal.dev. Swapping only "maths" for "math" would leave "math" next to "initialisation", which reads as a mistake, so the choice is between two whole-site options.

Machine learning itself is written in American English: paper titles (*Batch Normalization*), library APIs (`torch.nn.init`, `normalize`), and the CSS `color` property the design system uses. Readers in the UK, India, Pakistan and Australia read American technical English every day. Search engines treat "math" and "maths" as near-synonyms, with "math" searched far more worldwide. With one concept page live, switching now costs about an hour; after the 12-week plan it would cost hundreds of edits.

## Decision
- All site text, documentation, code comments and identifiers use American English: math, initialization, normalization, color, center, behavior, gray, license, toward, rigor.
- Dates on pages use the American form ("November 23, 2026").
- Paper titles and quotations keep the spelling of their source.
- `npm run check:content` fails the build if page prose (outside code, inline code and URLs) uses a common British form.
- Accepted decision records 0001–0009 keep the spelling they were written in; records are never rewritten.

## Consequences
- Prose, the brand and the domain agree, and prose matches the code readers copy into their own projects.
- Writers with British habits will hit the spelling check; its message names each word.
- The check covers pages only. Components, registries and docs rely on review and on this record.

## Alternatives considered
- **Stay British throughout.** Native for Commonwealth readers and no work, but leaves prose at odds with the brand, the domain and every library the code uses.
- **"math" only, British elsewhere.** The cheapest edit, and the worst result: visibly inconsistent.
