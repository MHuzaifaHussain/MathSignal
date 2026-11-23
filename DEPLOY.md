# Deployment Guide — MathSignal

## Cloudflare Pages Settings

| Setting              | Value                                              |
| -------------------- | -------------------------------------------------- |
| Framework preset     | Astro                                              |
| Build command        | `npm run build`                                    |
| Build output dir     | `dist`                                             |
| Node version (env)   | `NODE_VERSION` = `24.14.0`                         |

The site deploys through **Cloudflare Pages with Git integration**: every push to the production branch (`main`) deploys to mathsignal.dev, and every other branch gets a preview at `<branch>.mathsignal.pages.dev`. There is no deploy command and no wrangler config.

`npm run build` runs the design and content checks before Astro and the link check after it, so a deploy fails rather than publishing a broken page. Response headers (caching for `/_astro/*`, basic security headers) come from `public/_headers`.

## One-time Cloudflare settings (free plan)

Cloudflare moves menus from time to time. If a setting isn't where these steps say, type its name into the search box at the top of the dashboard.

1. **Let AI crawlers in** (the site's crawler policy, `public/robots.txt`, allows them). Open the `mathsignal.dev` domain, then **Security → Bots** (newer dashboards: **AI Crawl Control**). Set "Block AI bots" to **do not block**, and turn **off** Cloudflare's managed robots.txt so ours is served. Leave Bot Fight Mode off. Check: https://mathsignal.dev/robots.txt starts with "# MathSignal is an educational site".
2. **Web Analytics** (cookieless, so no cookie banner). **Workers & Pages → mathsignal → Metrics → Web Analytics → Enable**, or **Analytics & Logs → Web Analytics → Add a site**. Cloudflare injects the script itself; no repo change.
3. **Preview deployments.** **Workers & Pages → mathsignal → Settings → Builds → Branch control**: production branch `main`, preview branches "All non-production branches".
4. **HTTPS.** On the domain: **SSL/TLS → Edge Certificates**: Always Use HTTPS **on**, Automatic HTTPS Rewrites **on**, Minimum TLS Version **1.2**. Enable HSTS (max-age 6 months, include subdomains). `.dev` domains are HTTPS-only in browsers already, so this only tidies redirects.
5. **www to the bare domain.** **DNS → Records → Add record**: type CNAME, name `www`, target `mathsignal.dev`, proxied. Then **Rules → Redirect Rules → Create rule** from the template "Redirect from WWW to root": 301, keep the query string.
6. **Email address on the domain.** **Email → Email Routing → Get started**: create `hello@mathsignal.dev`, forward it to your inbox, confirm the verification email. Cloudflare adds the DNS records.
7. **Speed.** **Network**: HTTP/3 **on**. **Speed → Settings**: Early Hints **on**. Leave **Rocket Loader off**; it rewrites scripts and can break the interactive boards. **Caching → Configuration**: Browser Cache TTL "Respect existing headers", so `public/_headers` decides.

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
