# 0002: Two full themes

Status: accepted, 2026-11-23

## Context
An early version of Chalk Margin kept a dark header and dark boards in light mode, so light mode was half dark. The options were a hybrid, dark only, light only, or two complete themes.

## Decision
Two complete themes. Light mode is fully light: pale green-grey board (`#e4ebe6`) with a `#748a80` frame, light header. Dark mode is fully dark: slate board (`#22302e`) with a `#6a8079` frame on a `#171b1a` page. The theme follows the reader's system setting, with Starlight's toggle.

## Evidence
- Reading studies (Buchner & Baumgartner 2007; Piepenbrock et al. 2013, 2014) find dark-on-light text is read more accurately by people with normal vision, most of all for small text and fine detail.
- Nielsen Norman Group advises against dark mode as a default for general audiences, but recommends offering it.
- None of 20 comparable sites checked (Distill, 3Blue1Brown, d2l.ai, MDN, PyTorch, Hugging Face, scikit-learn, Stripe, Ciechanowski and others) is dark-only.
- A 2024 IEEE VIS study found chart-reading polarity preference varies by person and recommends offering both.
- Starlight supports two themes natively; forcing one theme needs overrides.

Scores (out of 50): two themes 41, light only 35, hybrid 34, dark only 24.

## Consequences
- Every colour has a light and a dark value, and both are checked by `npm run check:design`.
- Pure yellow can't be a line on light surfaces, so light mode uses ochre for "look here" lines.
- Print styles use the light board.
- The original dark-board frame (`#3e4f4b`, 2.0:1) failed on low-contrast screens; the brighter `#6a8079` (4.1:1) replaced it.

Amendment (2026-11-23): the light board frame and axis moved from `#748a80` to `#677c73` so slider tracks and the Reset border reach 3:1 on the tray as well as the board.
