# 0023: The full page footer and PropertiesTable

Status: accepted, 2026-11-25; amended 2026-11-26 (folds print open). Extends [0009](0009-single-sources-of-truth.md).

## Context
Concept pages already required `author`, `reviewedAt` and `aiAssisted` in frontmatter, but the footer showed only the author (from a site constant, so it could disagree with the JSON-LD), the review date, the licenses and "Report an error". Nothing told the reader how the page was made, although `aiAssisted` is set on every page, and there was no way to cite a page. On 2026-11-23 the owner deferred "Cite this page" and a reviewer line until there was a second person; on 2026-11-25 the week-2 plan asked for the full footer, and the ruling was to build "Cite this page" and "How this page was made" now, since neither needs a second person, and to keep the reviewer deferred, since a reviewer line without a reviewer would be false.

Distribution facts were hand-written markdown tables, one per page. The binomial page and the probability density page both need one, week 3 adds three more families, and a later discrete-distributions cheat sheet repeats six of them. Copies drift, as notation and references did before 0009.

## Decision
**Footer.** The existing Starlight `Footer` override stays the one place for it, so no page changes. On concept pages (frontmatter `topic` set) it now shows, under Starlight's previous and next links:
- "Written by {author}, last reviewed on {date}." with the author from frontmatter, the same name the JSON-LD gives. Other pages fall back to the site author.
- "How this page was made: drafted and reviewed with the help of AI tools, then checked by the author before publishing." The label links to the About page's section on AI tools. With `aiAssisted: false` it reads "How this page was made: written and checked by the author."
- A closed `<details>`, "Cite this page", holding one sentence saying the date is the last review, a plain citation (author, date, title, site, URL), and a BibTeX `@misc` entry in Starlight's `Code` block, whose copy button comes with Expressive Code. No line numbers. The entry's title sits in double braces, its month is a BibTeX macro, and its `note` says "Last reviewed YYYY-MM-DD". The citation claims no named style.
- On paper the credits stay hidden, as before, and a print-only line "Cite as: …" keeps the source on the page.

Links inside a sentence stay inline (the inline exception of WCAG 2.5.8). Only the action row, Report an error and About, and the "Cite this page" summary keep 44px targets.

The text lives in two pure modules, so `npm run check:boards` pins every string. `src/seo/citation.mjs` builds the citation. Author names are data in its `AUTHORS`, keyed by the `AUTHOR_NAME` constant: an unknown author fails the build, because parsing a display name guesses wrong on multi-part family names. Dates are read in UTC. BibTeX escaping is one pass with a lookup table, so `\` becomes `\textbackslash{}` without its braces being escaped again. A URL outside plain path characters fails rather than being escaped. `src/components/overrides/footerCopy.mjs` holds the footer's sentences.

**JSON-LD.** The concept page node gains `license` (the CC BY 4.0 URL, `TEXT_LICENSE_URL` in `src/seo/site.mjs`, also the footer's link) and `teaches` (the page's objectives). Both are true and on the page. No `reviewedBy`: there is no reviewer, and schema.org defines it on WebPage, not on the page's TechArticle/LearningResource node.

**PropertiesTable.** `src/data/distributions.mjs` joins the 0009 registries. Each family has an id, a name for the caption, its owner topic, its second column's heading and its rows (stable ids, a label and a statement). A page passes only its own third column:

```mdx
<PropertiesTable family="binomial" examplesHeading="On the boards" examples={{
  needs: "Without replacement: $1/15$, not $0.09$",
  …
}} />
```

- **Prose with `$…$` math, not TeX.** KaTeX sets `white-space: nowrap`, so prose inside `\text{}` can't wrap, reads as MathML text and is set in KaTeX's font. Labels, statements, headings and examples are prose with math segments. `src/components/properties/resolveRows.mjs` splits them at unescaped `$` (`\$` is a literal dollar sign), HTML-escapes the text and renders the math with `renderTex`, so `\vmu` and `\vsigma` keep their colors. An odd number of `$` fails, naming the family and row.
- **Fail loudly.** An unknown family or row, a repeated row, an empty `rows`, an example or link for a row not shown, an empty example, examples for only some rows (all or none, so the table never has holes), examples without a heading, a heading without examples, or a row link that isn't a site path each fail the build with the family and id named.
- **Markup.** A focusable region (`tabindex="0"`) named by the table's `<caption>` ("Properties of the binomial distribution"), so a keyboard reader can scroll it when a formula is wider than the column; row headers are `th scope="row"`. It sits in `.not-content`, so Starlight's `display: block` table rule doesn't apply, and its scoped styles copy the markdown tables' look: same fonts, padding, rules and header weight, with row headers in regular weight. A three-column table narrower than 30rem drops to 15px type, 6px gaps and hyphenation, so prose wraps instead of the region scrolling. In print the region doesn't clip and rows don't split.
- **Where.** Inside `FormalDefinition`, after the page's board and prediction, never before them. `#properties` (the default id; a second table on a page passes its own) opens the fold around it: the hash-open script moved from `Fold` into `src/components/openFoldForHash.ts`, which `FormalDefinition` imports too.
- **Checks.** `npm run check:content` fails a family's owner page that exists but doesn't show `<PropertiesTable family="…">`, a table naming an unknown family, and two tables that both use the default id. Its reader-word counter already skips the whole element. `npm run check:boards` pins every caption, heading, label and statement, every refusal message, and the math behind the rows: exact binomial sums, means, variances, the n/4 bound, the tallest bar (with its tie) for every n up to 10 and every p on the 0.05 grid, the mirror, the Bernoulli row and a convolution, all on DistributionBoard's own model; and the uniform's height, mean and variance on the density board's exact shapes.

Families registered now:
- **binomial**, owned by `probability/binomial-distribution`, with a Bernoulli row. The "Tallest bar" row states 0 < p < 1, since at p = 1 the floor of (n + 1)p is n + 1, not a value of X.
- **normal**, owned by `statistics/normal-distribution`. The page moved onto it in the same commit that added the owner-page check. The rows equal its old markdown table, cell for cell, and the only visible change is the caption.
- **uniform**, owned by `probability/probability-density-functions`, which absorbs the uniform distribution page. Its third column is a comparison, not examples: the page's Sand heap triangle, under the heading "Sand heap (triangle on 0 to 4 cm, top at 2 cm)". The caption stays "Properties of the uniform distribution", and the heading names what the column holds.

Not users: the generic properties of random variables and of expectation and variance (they describe every distribution and are tied to their boards), and the week-2 comparison pages' tables of statistics, whose rows belong to one page each.

## Consequences
- A distribution family page shows its table with `<PropertiesTable family=…>`, never a hand-written copy. Registering a family means writing its rows once and asserting their math in `check:boards`.
- The citation date follows `reviewedAt`, so a re-review changes the citation. That is intended: the reader cites the version they read.
- The footer gains about 115px at 375px with "Cite this page" closed (two lines of "How this page was made" and the 44px summary): 231px in all, against about 115px before. Open, it adds about 535px, mostly the wrapped BibTeX block (386px). Measured on the Normal page in Chrome at 375px.
- Tables at 375px wide, measured on the lab page: Normal 444px (the old markdown table was 417px; the 27px is the caption); binomial with its example column 1,220px, inside the closed `FormalDefinition`, so it adds nothing to the first view, and it fits without scrolling; uniform with the Sand heap column 343px. At 320px the binomial region scrolls by about 53px, the width of the widest unbreakable formula and word in each column; the page itself never scrolls sideways.
- Starlight's `Code` works inside the footer override, copy button included.
- Every fold prints open (amendment below), so the table reaches paper whether or not `FormalDefinition` was open on screen.
- The 17 hand-written markdown tables keep Starlight's block-scrolling table, with no row headers (amendment below).

## Amendment (2026-11-26): folds print open
Closed folds didn't print, so a PropertiesTable, a proof or a worked answer inside a closed `FormalDefinition`, `Fold`, `Simpler` or `GoDeeper` never reached paper.

- **CSS.** In print, `.sl-markdown-content details::details-content` gets `content-visibility: visible` (`global.css`, next to the disclosure rules). Browsers with `::details-content` (Chromium 131 and later) print every fold's body without opening it, so nothing changes on screen and nothing needs restoring. The selector has no `.not-content` guard, so folds inside island wrappers print too. Summaries are already `display: flex`, which drops the toggle marker, so nothing hides it.
- **Script.** `src/components/openFoldsForPrint.ts`, imported by `Fold` and `FormalDefinition` on the line after `openFoldForHash` (Astro bundles each once per page), covers browsers without `::details-content`. On `beforeprint` it opens every closed fold in `.sl-markdown-content` and remembers exactly those; on `afterprint` it closes them again, so a fold the reader opened stays open. A second `beforeprint` before `afterprint`, which some print previews send, adds to the list instead of replacing it. It's a sibling module, not part of `openFoldForHash.ts`, so each module keeps one job.
- **Every fold means every fold.** Check-yourself and worked-example answers print open under their questions. On paper there is no way to reveal them later, and a printout is usually for study.
- **Not affected.** The footer's "Cite this page" sits outside `.sl-markdown-content` and stays hidden in print (its "Cite as" line prints instead). Starlight's mobile table of contents and sidebar groups are outside it too. No fold on the site uses `name`, so opening one never closes another.
- **Measured** in Chromium (Playwright, `chrome-win64` 153) on the built Normal and binomial pages. With `emulateMedia({ media: 'print' })` and JavaScript off, the closed `FormalDefinition` grows from 52px to 1,231px (Normal) and 1,616px (binomial), its PropertiesTable passes `checkVisibility()`, and `page.pdf()` text holds the caption "Properties of the binomial distribution" with its rows; the same for Normal. `page.pdf()` fires `beforeprint` and `afterprint` once each. Opening one fold by hand, then dispatching `beforeprint` twice and `afterprint` once, opened all 9 (Normal) and 21 (binomial) folds and then restored the earlier state exactly, the hand-opened fold still open; the same after `page.pdf()`.

**Row headers in markdown tables: left as they are.** A site-wide rule would have to tell a row label from data in the first column, and the 17 tables mix both: property and rule tables and the contingency tables start with labels, while the ruler-length, group-size and Pascal's-triangle tables start with numbers. `scope="row"` is only valid on `th`, so it can't be added to a `td`, and the scroll-box script only handles overflow and shouldn't gain a second job. If row headers are wanted later, the narrow option is a build-time rehype rule that turns a first cell holding only bold text (the contingency tables' bold "Has it", "Hat" and "Heads") into `th scope="row"`; the property tables would still need an explicit marker.

## Alternatives considered
- A new `PageFooter` component placed by each page: 17 page edits for what the override already does on every page.
- Starlight's git-based `lastUpdated`: typo commits would restamp every page, and `reviewedAt` already says when a page was last checked end to end.
- An always-visible citation: about 7 more lines on a phone for something few readers need. It prints instead.
- A custom copy button: new JavaScript, when Expressive Code ships an accessible one.
- Statements as TeX with `\text{}` for words: they don't wrap (above).
- Properties in each page's frontmatter: TeX in YAML needs double escaping, and the rows couldn't be shared with hub pages without copying.
- A yellow highlight on the row a page is about: yellow means "look here", and a static table has no single place to look.
- A `notation` field on each family: nothing would read it yet; it can come back when a hub page checks symbols against its notation key.
