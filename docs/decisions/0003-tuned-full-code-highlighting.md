# 0003: Tuned full syntax highlighting

Status: accepted, 2026-11-23

## Context
Code blocks needed colours that fit the colour-means-meaning rule. A conventional palette (purple keywords, teal functions, orange numbers) competed with μ and σ, made keywords look like σ for readers with red-green colour blindness, and had four colours that Expressive Code would silently adjust for contrast. A "quiet" style (bold keywords, muted strings) protected μ/σ but felt unfamiliar to developers, and as first tuned it also failed colour-blindness targets in five places.

## Decision
Use a tuned full palette ("One Dark minus blue"): violet keywords, green strings, orange numbers, khaki italic comments, ink for names and calls. No blue, no pink, nothing bold in the theme. μ and σ identifiers get bold, their meaning colour, and a thin ring through a small Expressive Code plugin.

| | Light | Dark |
|---|---|---|
| Keywords | `#461f62` | `#b182ff` |
| Strings | `#0d4a22` | `#81a567` |
| Numbers, constants | `#6c1f03` | `#f6781e` |
| Comments, docstrings | `#464236` | `#ac9879` |
| Code ink | `#1e2725` | `#f2f0ea` |

## Consequences
- Every token is at least 5.6:1, so Expressive Code changes nothing; the build check guards it.
- Every token is at least 21 (normal) and 12.6 (colour-blind) CIEDE2000 from μ, σ and attention.
- In light mode the colours read close to near-black at reading size. Brighter purples and oranges collide with σ or "look here"; this is a known, accepted limit.
- No blue function names, One Dark's most recognisable cue: blue belongs to σ.
- Dark-mode tokens have little headroom above 5.5:1, so the check script is mandatory.

## Alternatives considered
- Quiet syntax: scored higher on μ/σ focus and cohesion, lower on familiarity. Rejected in favour of familiar highlighting.
- Conventional full palette: rejected for the colour-blindness collisions and silent contrast adjustments.
