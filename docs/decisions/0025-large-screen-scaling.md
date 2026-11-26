# 0025: The site grows on very large screens

Status: accepted, 2026-11-27.

## Context
On a 4K monitor or a TV at 100% scaling the browser is 2560 to 3840 CSS px wide, and the site was drawn for laptops. Measured in Chromium at 3840 × 2160: body text 19.2px, a 667px reading column (17% of the width) and boards capped at 720px, a strip of page in a field of empty paper. No width from 320 to 3840 scrolled sideways, so nothing was broken, only small.

Two prototypes, measured the same way:
- `:root { font-size: 200% }`. Starlight sizes in rem, so the text, the column, both sidebars, the header and the board frame all grew together, and dragging the Normal board's mean stayed exact (the pointer moved 180px, the point 180px). The Mafs plots grew wider but not taller, because their heights are px numbers in code, and their text, point radii and line weights stayed laptop-sized.
- `:root { zoom: 2 }`. Everything grew, but dragging broke: the mean point moved 359px for 180px of pointer, because Mafs maps pointer coordinates without knowing about CSS zoom.

## Decision
1. **The root font size grows above 1920px, nothing else changes.** `src/styles/global.css` sets, unlayered:

   ```css
   html { font-size: clamp(100%, calc(100% + (100vw - 120rem) / 240), 150%); }
   ```

   That is 100% (16px with the browser's default) up to 1920px, rising by 1px for every 240px of width, and 150% (24px) from 3840px on. Phones, laptops and 1920px screens get exactly today's sizes: below 1920px the middle term is under 100% and the clamp holds it there.
2. **Browser zoom still enlarges text (WCAG 1.4.4).** Zooming narrows the viewport in CSS px, which takes back some of the growth, so the curve is gentle enough that zoom always wins. On a 3840px screen at zoom z the viewport is 3840/z CSS px, the root is 16 + (3840/z − 1920)/240 CSS px while that is at most 24, and the text a reader sees is z times that: **8z + 16 px**. That is 24px at 100%, 28px at 150% and 32px at 200%, always rising. A 2× curve (32px at 3840) would have made 200% zoom render the same size as 100%. The rule uses rem and %, so a reader who set a larger default font keeps it, and their curve starts later (120rem is wider for them).
3. **Not CSS zoom.** It broke dragging by a factor of two (measured above) and would need every pointer handler to divide by the zoom.
4. **Gentle, 1.5× and no more.** At 3840px everything is one and a half times its laptop size: body text about 29px where the prototype measured 19.2px, and the reading column about 1,000px, still one comfortable measure. Past that the layout would need a second column, which is a design change, not a size change.
5. **Boards share one scale factor.** `useBoardScale()` (`src/components/react/useBoardScale.ts`) returns the root font size divided by 16: 1 below 1920px, 1.5 at 3840px. Every Mafs board multiplies its px design constants by it: plot heights, `Text` sizes, line weights, stroke widths. Grid-unit values (positions, ring radii in units, label offsets in units) are never scaled. It is a shared store read with `useSyncExternalStore`: one `resize` listener for every board, at most one read per animation frame, and boards re-render only when the value changes. Islands are rendered on the server too (`client:visible` hydrates server HTML), so the server snapshot is 1 and the board grows right after it hydrates; a read in a `useState` initializer would leave the server's px height on the hydrated board, because React doesn't patch attributes or styles that differ at hydration.
6. **Mafs internals that props can't reach** are set in rem in `src/styles/components.css` under `.ms-board .MafsView`: the point radius (Mafs' 6 → 0.375rem), a movable point's ring (15 → 0.9375rem), its hover, focus and drag radii, its focus ring, its 30px hitbox (1.875rem), the 3px text halo, the dash pattern, the dotted pattern and the 5px gap between an axis and its numbers. A CSS `r` beats the attribute Mafs writes. Each has to be rechecked on a Mafs upgrade. The axis lines and the grid stay 1px: they are hairlines, like the board's frame.
7. **Label layouts run at the base size.** FunctionCurve and VectorBoard2D place labels with px measurements taken at the base font sizes (label widths, the axis numbers' boxes, dot radii, clearances). Instead of threading the scale through that math, the planes call it with `planeSize / scale` (`layoutPlaneSize`) and draw the text at its base size × scale. Every px in the layout scales together, so the positions in grid units are identical at every scale; `npm run check:boards` asserts it.
8. **HTML boards in rem.** In `components.css`, px that size content on the HTML boards (EventSpace, DistributionBoard, DescriptiveStats, the Bayes trays, TraySlider, TrayChoice) become rem at the exact same value (399px → 24.9375rem), so nothing moves below 1920px. Container-query lengths in rem use the initial font size, not the root's, so the board breakpoints stay where they are at every width; inside a breakpoint the content still grows with the root. The plane caps (440px and 400px) become rem too, so the square planes grow with the page.

## Consequences
- Below 1920px every computed size is what it was: the root is 16px and every converted rem is an exact multiple of 1/16.
- A reader who set a larger default font now gets boards scaled with it, since the plots' text already followed their font; on a narrow phone their label layouts run on a plane under 270px and may leave out an optional label more often.
- The server HTML of a Mafs board is drawn at scale 1, so on a very large screen a board grows once when it hydrates.
- Px that stay px: 1px hairlines (borders, axis and grid lines), border radii, outline widths and offsets, focus halos, and the 44px minimum tap target (a floor, not a size).
- A new Mafs board uses `useBoardScale()` for every px it passes to Mafs, and a new HTML board writes its sizes in rem. `npm run check:boards` fails on a Mafs `height`, `size` or `weight` that isn't scaled.

## Alternatives considered
- **CSS zoom:** breaks dragging (above).
- **A 2× curve:** cancels browser zoom at 200% on a 3840px screen.
- **Media-query steps** (for example 18px at 2560 and 24px at 3840): jumps at each step, and each step needs its own zoom check. The clamp is continuous.
- **Scaling only the content column:** the sidebars, header and boards would stay small beside it.
- **Measuring each board's width instead of the root font size:** boards would disagree with the text around them, and the label layouts would need the scale threaded through every px.
