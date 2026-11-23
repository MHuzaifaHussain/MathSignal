# Accessibility

Target: WCAG 2.2 AA in both themes. `npm run check:design` enforces the color rules below on every build.

## Contrast

| Kind | Minimum | Applies to |
|---|---|---|
| Text | 4.5:1 | Body, muted text, labels, μ/σ symbols, line numbers |
| Graphics | 3:1 | Board frame against the page, axes, plot strokes, focus indicators |
| Code tokens | 5.5:1 | Every syntax color, so Expressive Code never alters it |

Yellow can't reach 3:1 on light surfaces. In light mode "look here" is ochre for lines and yellow only as a fill with ink on top.

## Color blindness

- Meaning is never carried by color alone. μ and σ also have a symbol or name, and in code a bold weight and a ring.
- Code colors keep a CIEDE2000 distance of at least 20 from μ, σ and attention for normal vision, and at least 12 under simulated deuteranopia, protanopia and tritanopia (Machado 2009).
- μ and σ are only 13 apart under protanopia, which is why σ always has its name or symbol next to it.

## Keyboard and screen readers

- Every board has a tray slider for each draggable handle, with `aria-valuetext` in words ("mean 1.50").
- Board figures have an accessible name (`Board`'s `label`).
- Live regions are polite and update when an interaction ends, never on every frame.
- The focus ring is visible on every surface (ink outline plus yellow halo).
- Interactive targets are at least 44px.
- KaTeX keeps its hidden MathML output for screen readers.
- Respect `prefers-reduced-motion`.

## Manual checks before merging a visual change

1. Both themes, at 375px and 1280px wide.
2. Keyboard only: Tab through the header, sidebar, every board control and Run button.
3. Zoom to 200%: nothing overlaps or scrolls sideways.
4. A board on a dim or low-contrast screen: the frame still separates it from the page.
