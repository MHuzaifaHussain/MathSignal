# 0005: Remove Tailwind

Status: accepted, 2026-11-23

## Context
Tailwind v4 and `@astrojs/starlight-tailwind` came with the first version of the site. After the Chalk Margin redesign, every component is styled with `--ms-*` tokens in scoped Astro styles or `src/styles/components.css`. The only Tailwind classes left were in the unused `MarimoEmbed`, and `global.css` overrode every colour mapping the Starlight bridge set up.

## Decision
Remove `tailwindcss`, `@tailwindcss/vite` and `@astrojs/starlight-tailwind`, and restyle `MarimoEmbed` with tokens. Supersedes the Tailwind note in [0004](0004-stay-on-astro-starlight.md).

## Consequences
- One styling system: tokens plus component CSS. Utility classes can no longer bypass the colour rules or the design check.
- Three fewer dependencies and one less Vite plugin to keep in step with Astro and Starlight upgrades.
- Layout utilities that Starlight itself provides (`sl-flex`, `sl-hidden`, `md:sl-flex`, `print:hidden`, `sr-only`) are still available.
- Re-adding Tailwind later is a small change if a real need appears; it should come with a new decision record.
