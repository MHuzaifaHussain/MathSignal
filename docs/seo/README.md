# SEO at MathSignal

Balanced SEO: pages are written for learners first, and search engines and AI assistants find them because they are clear, correct and well linked. Nothing here should change the tone of an article. If an SEO idea makes a sentence worse for the reader, drop the idea.

Sources: Google's guidance on helpful and scaled content, and the site audit of 2026-11-23.

## Principles

1. **Learner first.** Never add a keyword a sentence doesn't need. The concept's name appears naturally in the title, the description, the first sentence and at most one heading, and nowhere forced.
2. **One page, one question, one intent.** Each page answers one main query. "X vs Y" lives on comparison pages, "how to" on worked examples. Two pages never compete for the same query.
3. **Answer first.** The page opens with one quotable sentence that names and defines the concept ("The normal distribution is…"). The first sentence under each `##` answers that heading; story and analogy follow. This is what answer engines quote.
4. **Titles are descriptive, not hyped.** The full `<title>` (page title plus " | MathSignal") stays at or under about 60 characters. Mix plain, question and task titles; use a colon subtitle in at most about one title in three.
5. **Descriptions are written by a person.** Unique, 120–160 characters, saying what the reader can do on the page. American spelling (decision 0010), no em dash, no list of synonyms.
6. **Show sources and people.** Verified citations with links, a real author and review statement, an honest note on how AI is used, and a date that changes only when the content changes substantively.
7. **Structured data for clarity, not tricks.** `WebSite` and `Organization` on the home page; `BreadcrumbList` and `TechArticle`/`LearningResource` on concept pages (built in `src/seo/structuredData.ts`). Only fields that are true and on the page. No FAQ markup.
8. **One page serves people, Google and AI assistants.** Never write separate content for machines. `/llms.txt` is generated from the same pages (`src/pages/llms.txt.ts`).
9. **Scale safely.** Publishing many pages from one template is only safe if every page adds its own value: its own objective, examples, numbers, board preset and ML use. Near-duplicate pages stay drafts. Release in batches, and when quality and count conflict, the count goes down.
10. **Links carry meaning.** Anchor text names the target concept ("the central limit theorem", never "here"). Every new page gets at least two contextual links from existing pages in the same change. No orphan pages. Hub pages only once they have real spokes. Internal links are relative paths ending in `/`.
11. **Technical hygiene.** A social card on every page (`public/og/default.png`, set in `astro.config.mjs`), a canonical URL, the sitemap, one URL form (trailing slash), a deliberate AI-crawler policy in `public/robots.txt`, boards that reserve their height (no layout shift), and a small JavaScript budget for islands.
12. **Measure beyond Google.** Search Console and Bing Webmaster Tools (with IndexNow), Core Web Vitals, and a monthly check of how AI assistants cite the site. Change things only on evidence.

## Checklist for a new page

- [ ] Title is plain and descriptive; full `<title>` ≤ ~60 characters.
- [ ] Description is human-written, 120–160 characters, unique.
- [ ] First sentence defines the concept by name; each `##` opens by answering itself.
- [ ] The concept's name isn't repeated more than reads naturally.
- [ ] At least two existing pages link to it with descriptive anchor text.
- [ ] References are real and linked.
- [ ] `npm run build` passes; the page appears in `dist/llms.txt` and has a JSON-LD block.

## What we don't do

Keyword density targets, keyword-stuffed headings, doorway pages, FAQ sections written for snippets, AI-only content, hidden text, buying links, or rewriting a good sentence to fit a search phrase.
