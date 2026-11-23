# AI assistant skills and tools

Recommended skills and tools for working on MathSignal with an AI coding assistant (written for Claude Code; most skills also work in other agents that read `SKILL.md`). They make results better and more consistent with the design system. None are required to build the site.

## Rule for assistants: recommend before changing

Before starting any change (code, content, styling, dependencies):

1. Find the change type in [Which skill for which change](#which-skill-for-which-change).
2. Tell the developer which skills or tools apply and why, in one or two lines, and ask whether to use them. Don't invoke a skill the developer hasn't agreed to, unless they've already said to use it for this task.
3. **If a recommended skill or tool isn't installed, say so and suggest installing it** with the command from [Install](#install), explaining what it would improve. Then carry on without it if the developer prefers; never install anything without their go-ahead.

Skip the recommendation for trivial edits (a typo, one line of copy). Whatever skills are used, [AGENTS.md](../../AGENTS.md) and [the design system](../design-system/README.md) still apply.

## Which skill for which change

| Change | Recommend | Why |
|---|---|---|
| New feature, component or page; anything creative | `superpowers` brainstorming, then writing-plans | Settles what to build before building it |
| New concept page | MathSignal concept-page skill (when available, see below), plus [writing-a-concept-page.md](../design-system/writing-a-concept-page.md) | Keeps the nine-section template and color rules |
| Visual or layout change, new UI | `frontend-design`, `web-design-guidelines` | Distinctive design that still follows Chalk Margin |
| New plot, chart or board | `dataviz` (if your assistant offers it) | Consistent, accessible charts; also follow [math-plots-code.md](../design-system/math-plots-code.md) |
| React island work (boards, runner, sliders) | `react-best-practices`, `composition-patterns` | Hooks, re-renders, composition. Both are Next.js-oriented; apply only the React parts |
| Speed, bundle size, fonts, Core Web Vitals | `performance`, `core-web-vitals`, Chrome DevTools MCP | Measured with real traces, not guessed |
| Accessibility review | `accessibility` (web-quality-skills), `web-design-guidelines`, optionally AccessLint | Target is WCAG 2.2 AA ([accessibility.md](../design-system/accessibility.md)) |
| Titles, descriptions, links, structured data, discoverability | `seo-audit`, `ai-seo`, `programmatic-seo` (marketingskills); `seo` (web-quality-skills) | Balanced SEO that never changes the tone: follow [docs/seo/README.md](../seo/README.md). `programmatic-seo` matters because many pages share one template |
| A bug or unexpected behavior | `superpowers` systematic-debugging | Root cause before fixes |
| Logic that can be unit-tested | `superpowers` test-driven-development | Only once a test setup exists; the repo has none today |
| Before saying work is done | `superpowers` verification-before-completion | Run `npm run build` and `npm run check`, show the output |
| Before merging or after a large change | `/code-review`, `/simplify` | Correctness review, then clean-up |
| Changes to the Python runner, KaTeX trust, iframes or external URLs | `/security-review` | The runner loads code from a CDN; KaTeX trust is deliberately narrow |
| Page copy and docs prose | `humanize-writing` | Plain, human writing |
| Astro or Starlight APIs | Astro Docs MCP, Context7 | Current docs instead of memory |
| Creating or improving a skill | `skill-creator` | Includes evaluation |

## Install

Run plugin commands inside Claude Code. `/code-review`, `/simplify` and `/security-review` are built into Claude Code and need no install.

### From the official Claude marketplace (`claude-plugins-official`)

| Plugin | Command |
|---|---|
| superpowers (brainstorming, plans, debugging, TDD, verification) | `/plugin install superpowers@claude-plugins-official` |
| frontend-design | `/plugin install frontend-design@claude-plugins-official` |
| skill-creator | `/plugin install skill-creator@claude-plugins-official` |
| Chrome DevTools MCP (Lighthouse audits, performance traces) | `/plugin install chrome-devtools-mcp@claude-plugins-official` |
| typescript-lsp (type errors in `.tsx` while editing) | `npm install -g typescript-language-server typescript`, then `/plugin install typescript-lsp@claude-plugins-official`. Keep `npm run check` for `.astro` and `.mdx` |
| Context7 (library docs, including Mafs and Starlight) | `/plugin install context7@claude-plugins-official`, then sign in through `/mcp` |

### From GitHub

| Skills | Command |
|---|---|
| `react-best-practices`, `composition-patterns`, `web-design-guidelines` (Vercel) | `npx skills add vercel-labs/agent-skills` |
| `performance`, `core-web-vitals`, `accessibility`, `seo` (Addy Osmani's web-quality-skills) | `/plugin marketplace add addyosmani/web-quality-skills`, then `/plugin install web-quality-skills@addy-web-quality-skills` (or `npx skills add addyosmani/web-quality-skills`) |
| `humanize-writing` | `npx skills add jpeggdev/humanize-writing` |
| `seo-audit`, `ai-seo`, `programmatic-seo` (Corey Haines' marketingskills) | `npx skills add coreyhaines31/marketingskills --skill seo-audit ai-seo programmatic-seo`, or as a plugin: `/plugin marketplace add coreyhaines31/marketingskills`, then `/plugin install marketing-skills@marketingskills` |

### MCP servers and community tools

| Tool | Command |
|---|---|
| Astro Docs MCP (official) | `claude mcp add --transport http astro-docs https://mcp.docs.astro.build/mcp` |
| AccessLint (community, WCAG 2.2) | `claude plugin marketplace add accesslint/skills`, then `claude plugin install accesslint@accesslint`. Review its auto-fixes before accepting them |

### Not yet available

- **MathSignal concept-page skill:** planned, to be built with `skill-creator`. It would encode the nine-section page template, the `\vmu`/`\vsigma` rules, `Board` usage and a KaTeX build check.

Later, only when needed: `cloudflare` (official marketplace; Workers-focused), `playwright` (official marketplace; only once a test setup exists).

Avoid: community LaTeX skills, and the `starlight-katex` package.

## Libraries to suggest when a page needs them

From [decision record 0004](../decisions/0004-stay-on-astro-starlight.md). Don't add them before a page uses them.

| Library | Suggest when |
|---|---|
| react-three-fiber, drei, three | The first 3D linear algebra page (load with `client:only="react"`) |
| Observable Plot | The first histogram or central limit theorem page |
| Motion | A board needs spring animation; respect reduced motion |
| mdx-marimo | As a replacement for `MarimoEmbed`, once it supports Starlight's MDX version |

Keep TypeScript on 6.x until `@astrojs/check` supports 7. Remove the KaTeX `overrides` entry in `package.json` once rehype-katex, Mafs and micromark declare `^0.19`.

Install commands were checked against each project's README or the official marketplace listing on 2026-11-23.
