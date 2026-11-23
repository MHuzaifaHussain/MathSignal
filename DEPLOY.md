# Deployment Guide — MathSignal

## Cloudflare Pages Settings

| Setting              | Value                                              |
| -------------------- | -------------------------------------------------- |
| Framework preset     | Astro                                              |
| Build command        | `npm run build`                                    |
| Build output dir     | `dist`                                             |
| Deploy command       | `npx wrangler pages deploy dist --project-name=mathsignal` |
| Node version (env)   | `NODE_VERSION` = `24.14.0`                         |

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
