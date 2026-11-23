# Deployment Guide — MathSignal

## Cloudflare Pages Settings

| Setting              | Value                                              |
| -------------------- | -------------------------------------------------- |
| Framework preset     | Astro                                              |
| Build command        | `npm run build`                                    |
| Build output dir     | `dist`                                             |
| Deploy command       | `npx wrangler pages deploy dist --project-name=mathsignal` |
| Node version (env)   | `NODE_VERSION` = `24.14.0`                         |

The deploy command is only needed with Workers Builds; Pages' Git integration deploys `dist` itself and has no such field.

`npm run build` runs the design and content checks before Astro and the link check after it, so a deploy fails rather than publishing a broken page. Response headers (caching for `/_astro/*`, basic security headers) come from `public/_headers`.

## DNS Setup

1. In Cloudflare Dashboard, go to the Pages project → **Custom domains**
2. Add `mathsignal.dev`
3. If DNS is on Cloudflare: auto-configured
4. If external DNS: add CNAME record pointing `mathsignal.dev` → `mathsignal.pages.dev`
5. Optionally add `www.mathsignal.dev` as a redirect

## Post-Deploy Verification

- [ ] Visit https://mathsignal.dev — home page loads with the subject list
- [ ] Visit https://mathsignal.dev/statistics/normal-distribution/ — full page renders
- [ ] Interactive Mafs visualization loads and responds to dragging
- [ ] KaTeX math renders correctly (check the formal definition section)
- [ ] Code blocks have syntax highlighting in both themes
- [ ] Dark/light mode toggle works
- [ ] Search works (Pagefind index loads)
- [ ] Logo and favicon display correctly
- [ ] https://mathsignal.dev/sitemap-index.xml returns valid XML
- [ ] https://mathsignal.dev/robots.txt is accessible
- [ ] Check mobile layout (sidebar collapses, content readable)
- [ ] https://mathsignal.dev/llms.txt lists only published pages
- [ ] https://mathsignal.dev/og/default.png loads (the social card)
- [ ] A missing URL shows the 404 page
- [ ] A file under `/_astro/` returns `Cache-Control: public, max-age=31536000, immutable`, and pages return `X-Content-Type-Options: nosniff`
- [ ] A runnable Python example still runs (Pyodide loads from jsDelivr)
