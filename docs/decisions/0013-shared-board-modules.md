# 0013: Shared guided board modules

Status: accepted, 2026-11-24

## Context
EventSpace (decision 0011) and DistributionBoard (decision 0012) each built the same guided pieces: a live-region announcer that empties and refills itself, Check with a limit on wrong answers before "Show the answer" appears, a "Show as" stage choice that leaves out stages not allowed yet, a row of preset buttons, and refused controls that stay focusable and point at a visible reason. DistributionBoard copied them from EventSpace. Decision 0012 set the trigger for sharing them: a third board must lift the stage and lock code into `Board` first, rather than copy it a third time. Two new boards are next, a 2D vector board and a descriptive statistics board, and both need presets, Check (one as a one-shot sign guess), stages, refusals and the announcer.

The plan also named this work as a Board API with a `stages[]` prop, and later as goal and presets props on `Board`. Putting it in `Board` means guessing one configuration API that fits a Mafs plot, an outcome table and a bar chart, and it turns a simple frame into a component that knows about goals, stages and presets.

## Decision
- **Composable modules in `src/components/react/guided/`, not new `Board` props.** `Board` stays a simple frame: label, canvas, tray, Reset and the live region. Boards compose the pieces they need inside their tray. This supersedes 0012's consequence "a third board must lift it into `Board` first", and the plan's "Board API `stages[]`" wording.
- **The pieces:**
  - `guided.ts` (pure): `CHECKS_BEFORE_ANSWER` (2), `CheckProgress` (`checked`, `failedChecks`), `recordCheck(progress, passed, mode)` with a `retry` mode (a miss counts and the reader tries again) and a `once` mode (any committed answer reveals, for a one-shot guess), `canShowAnswer`, and `stageAllowed(stage, { stages, waitsForCheck, covered })`. `recordCheck` throws when Check has already passed, so a reducer that forgets its guard fails loudly.
  - `announcer.ts` (pure) and `useAnnouncer.ts`: the polite live-region pattern. Each message empties the region and refills it 50 ms later, so a repeated message is spoken again; a newer message replaces one still waiting, so a burst of key presses is spoken once after its pause; pending timers are dropped on unmount. `announce` keeps its identity across renders.
  - `CheckButtons.tsx`: Check until it passes, plus "Show the answer" once `canShowAnswer` is true.
  - `StageChoice.tsx`: a `TrayChoice` that offers only the allowed stages and draws nothing when fewer than two are left. Stages that aren't allowed yet are left out, never shown disabled, because a native radio can't refuse an arrow key.
  - `PresetButtons.tsx`: one labeled group of preset buttons, with `aria-pressed` only on boards whose presets stay selected.
  - `refusal.tsx`: `refusedBy(reasonId)` for a refused control (`aria-disabled` and `aria-describedby`, never `disabled`) and `RefusalNote` for its visible reason.
- **The pieces own no wording.** Labels, legends and refusal sentences come from each board's own copy, as before.
  - amended 2026-11-25 by [0017](0017-table-view-fold.md): `TableFold` owns `TABLE_FOLD_LABEL`, `TABLE_FOLD_SHOWN` and `TABLE_FOLD_HIDDEN`, because one switch must read and speak the same on every board; each board still writes the body of its opening sentence. Every other piece still owns none.
- **Each board keeps its state shape and its own rules.** Reducers spread `recordCheck` into their state and call `stageAllowed`, and they still decide what is locked, covered or refused and why. EventSpace keeps its small-grid rule for pictures; DistributionBoard keeps Symbols waiting for the match.
- **Goal sentences stay with each board**, because each board states its goal differently (a status line, a goal line with its own Check). Presets are lifted as a component, not as a `presets[]` prop on `Board`.
- **The plan's "minimal Board API" item (goal, `presets[]`, predict, describe/table) is superseded by these modules.** Goal, predict and the describe and table text stay with each board, in its own `describe.ts` and components.
- **EventSpace and DistributionBoard now use the modules.** Every existing board check passes unchanged, and the rendered markup of both lab pages is the same apart from the unified class names below.

## Consequences
- The vector and descriptive statistics boards compose these pieces instead of copying them. A new guided behavior goes into `guided/` with a check in `check-boards.mjs`, and every board that uses it changes together.
- **This amends 0012 in two places.** The announcer is shared before the screen-reader pass 0012 asked for, so that pass now covers one implementation used by every HTML board, and a problem it finds affects all of them at once. And the lock plumbing (`refusedBy`, `RefusalNote`) is shared while the lock conditions stay with each board.
- One class each replaces the per-board copies: `.ms-board-presets` and `.ms-board-presets-label` for preset groups, `.ms-board-refusal` for refusal notes. All refusal notes are now hidden in print with the controls they explain; EventSpace's shrink and cup notes used to print. The preset caption ("A:", "Fill:") is hidden from screen readers on every board, because the group's name already says it.
- BayesTheorem is unchanged: its example buttons keep their own classes and look.
- The Mafs handle-label fix in `Board` that the vector board needs (stale labels when a stage adds or removes a handle) is not part of this change; it lands with that board.

## Alternatives considered
- **Board props (`stages[]`, `goal`, `presets[]`, `predict`).** One place to configure everything, but an API guessed into the frame component, and it ties Mafs boards to rules only the HTML boards use today.
- **Copy the pieces into a third board.** Fastest, and 0012 forbids it.
- **Share only the pure rules and keep the React pieces local.** Smaller, but it leaves the refusal markup and the announcer timing, where accessibility bugs hide, in three copies.
