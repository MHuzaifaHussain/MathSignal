# 0017: A "Table view" fold for tall boards

Status: accepted, 2026-11-25

## Context
Every board shows a native table as the chart's accessible and printed equivalent. On a phone those tables made the boards far taller than the 480px guideline in [foundations.md](../design-system/foundations.md): DescriptiveStats ran from about 1,200 to 1,800px at 375px, and decisions 0012, 0014 and 0015 each left the excess as an open question for the owner. The owner ruled for the learner on 2026-11-25: tall boards fold their data tables behind one shared switch, and the chart, the controls and the readout sentences stay visible. On a phone the reader needs the chart next to the controls, and the table is a check, not the main view. The table always prints, screen-reader users keep the readouts and announcements and can open the table, and one switch behaves the same on every board. BayesTheorem already had such a switch (decision 0016), named "Show as table".

Three other boards have a stage choice whose legend is "Show as", which is live on published pages. Two controls that both start with "Show as" read as one choice to a screen-reader user.

## Decision
- **One shared fold, `guided/TableFold.tsx`**, with the API `{ open, onToggle, children }`. It renders a `role="switch"` button named "Table view" and, directly after it in the DOM, the region that holds the table (`aria-controls` points at it). It is the last tray item before Reset. Off, the region is `display: none` on screen and out of the accessibility tree; in print it always shows. The `hidden` attribute is never used, because print can't override it, and `<details>` was rejected because a closed one prints closed. The fold owns no state and announces nothing itself.
- **Shared copy.** `guided/tableFold.ts` holds `TABLE_FOLD_LABEL` ("Table view"), `TABLE_FOLD_SHOWN` ("Table shown under the switch.") and `TABLE_FOLD_HIDDEN` ("Table hidden."). `tableFoldAnnouncement(open, body)` joins the opening and a board's own body. It throws, naming the body, when the body is empty, has no final period, or starts with "Table shown" or "Table hidden", so a board that forgets or doubles its sentence fails in `check-boards`. This amends 0013's "the pieces own no wording" for this one piece: one switch must say the same thing everywhere, and one constant can't drift. "Table view" doesn't start with "Show as", so it can't read as a fourth view.
- **Every table-bearing board uses it**, and every new board will:
  - BayesTheorem (amends 0016): its own switch became the fold, renamed, and its opening sentence is now the shared one, since the table sits directly under the switch.
  - DescriptiveStats (amends 0015): the data and summary tables fold. While `class-lineup` waits for Check, the covered panel is gone; its sentence ("The summary appears when you find the middle of the class.") is a readout line under the chart, outside the fold.
  - DistributionBoard (amends 0012): the bars table folds. While a goal setup is covered there is no table, so no switch; it arrives with the chart when Check passes, and the reducer ignores the switch while covered.
  - VectorBoard2D (amends 0014): see below.
- **Each board's reducer owns `tableOpen`** (Bayes keeps a `useState`). It is off at the start and after Reset; presets, stages, scales, cutoffs and Check leave it as it is, and while it is open every change updates the table.
- **VectorBoard2D's − / + buttons leave the table** for an always-visible strip under the readouts (`vectorBoard/VectorSteppers.tsx`): one group per movable vector, named by it ("Trip a", "Your guess", "a"), holding the two existing per-axis groups, with the column words ("Steps east", "x (east)") over them for the eye only. Decision 0014 named the table the dependable keyboard path, and the owner keeps controls visible, so the controls moved out of the table instead of folding with it. The coordinate table is now read-only and folds. The strip's rows come from `stepperRows`, the table rows that have buttons, so the two can't disagree. Handle names now end "It also moves with the buttons under the plane" instead of pointing into the table, and the board names say "step buttons under the plane". With the buttons gone the Length column fits the tray at 320px, so the narrow-board length sentences were removed.
- **No control in a fold.** `check-boards` resolves the one component each `<TableFold>` wraps and requires it to be listed in `TABLE_FOLD_CHILDREN` in `scripts/check-boards.mjs` (which also fails if a listed table is folded by no board), and a listed file may contain no button, input, select, textarea, `tabIndex` or focus, key or click handler. Folding the region can never strand focus.
- **No sideways scrolling.** The region has no `overflow-x`; a scrolling region would need its own focus stop. Every folded table must fit the tray's inner width (about 255px at a 320px viewport), checked in the browser: every Bayes scenario, every DescriptiveStats setup and DistributionBoard setup, and every VectorBoard2D setup before and after Check fit with the table open.
- **The fold is never a spoiler gate.** It always prints and anyone can open it, so content that answers a page's prediction stays unrendered by board state (covered setups, stages, scales, the giant), folded or not. The rule and the DescriptiveStats gates are in 0015's amendment.
- **Equivalents, said truthfully.** DistributionBoard's readouts give every bar's members and chance, so they hold everything its table does. DescriptiveStats' readouts never list each value, and VectorBoard2D's `trips-add` readouts give no lengths; for those the chart's equivalent is the readouts plus the tables behind Table view, and the opening sentence says what the tables hold ("It lists the 9 children, with their heights and places in line, and then the summary."). The `class-lineup` pick radios were to carry each child's height ("Child 1, 133 cm"), but that made the tray 96px taller at 375px, past the 48px allowed, so they keep "Child 1" and the table is the screen-reader path to each height, as it is on `cafe-millionaire`, `pumpkin-outliers` and `marks-scaling`.
- **Reset moves below an open table.** `Board` renders Reset after the tray, so an open full-width region pushes it down. Never reordered with CSS `order`: a visual order that differs from the DOM fails WCAG 2.4.3.
- **The two Bayes pages audited under the no-spoiler rule**, no gate needed:
  - `screening-clinic` (base rate fallacy): the page says "Leave Table view off for now: you will count these groups yourself below." That is reading advice, not a gate. The readout the reader has already seen, "P(A | B) = 0.803 P(B) = 0.355", gives 355 positives and 0.803 × 355 ≈ 285 true positives, so 70 false positives, and the 300 who have the condition is the prose's own number. The table adds only the 15 missed and 630 cleared, which the exercise doesn't ask for.
  - `fraud-flag` (law of total probability): the page tells the reader to save Fraud flag for worked example 5, and the sentence that names Table view sits inside that example's solution. The readout's P(B) = 0.061 already rounds the 608 of 10,000.

## Consequences
- Heights at 375px with the table folded, measured on the lab pages on 2026-11-25 (opening, then other states):

  | Board, setup | Folded height |
  |---|---|
  | DescriptiveStats `class-lineup` | 919px opening, 935px after the answer |
  | `cafe-millionaire` | 645px opening, 745px with the millionaire in |
  | `class-spread` | 1,172px opening, 1,252px on Tight class |
  | `class-box` | 432px on Line-up, 504px on Quartiles, 567px on Box plot |
  | `marks-scaling` | 757px opening |
  | `pumpkin-outliers` | 925px opening, 952px with one giant |
  | DistributionBoard `candy-build` | 882px covered (no switch), 1,357px after the answer |
  | `coins-heads` | 733px covered (no switch), 1,130px after the answer |
  | `candy-balance` | 1,531px opening |
  | `candy-spread` | 1,388px opening, 1,571px with the spread shown |
  | VectorBoard2D `trips-add` | 842px opening, 1,165px after the answer |
  | `trips-scale` | 854px opening, 961px after the answer |
  | `cart-push` | 638px opening, 849px after the answer |
  | `align` | 868px opening, 899px after Check |

- The 480px target is met only by `class-box` on its Line-up step. The rest of the excess is the trays on DescriptiveStats (the `class-spread` tray holds a 9-child radio group, two switches, a slider and three presets), the stacked steppers and readout sentences on DistributionBoard, and on VectorBoard2D the square plane (0014 keeps it square so 90° looks like 90°), the status line, the strip and the readouts. Each is its own later change.
- Against the unfolded heights the design measured, the fold saves about 420–860px per DescriptiveStats state, 160–260px on DistributionBoard and 50–160px on VectorBoard2D.
- **Amended 2026-11-26: BayesTheorem heights.** The table above left BayesTheorem out; [0016](0016-bayes-board-presets-and-table.md) gave only the lab page's 828px. Measured on the built pages with the table folded, at 320, 375 and 1280px: 950, 877 and 718px on law-of-total-probability (four presets), and 854, 829 and 670px on base-rate-fallacy-medical-test and bayes-theorem (three presets). With the table open at 320px they are about 1,300 to 1,350px and 1,210 to 1,280px, and every scenario's table fits without scrolling sideways. The excess over 480px is the 340px plot, the presets (a fourth preset wraps onto its own row at 375px), the scenario sentence, three tray sliders with their labels on their own lines under 400px, and the readout. Each is its own later change, like the other boards' excess.
- A new board adds its table component to the fold scan's list in the commit that wraps it, writes one body sentence, and gets `tableOpen` in its reducer.
- Whether `role="switch"` or an `aria-expanded` disclosure reads better for show-and-hide is a question for the NVDA and VoiceOver pass; if it changes, it changes once, in `TableFold.tsx`.

## Alternatives considered
- **`<details>` and `<summary>`.** Native, but a closed `<details>` prints closed.
- **A "Table" value in the "Show as" stage choice.** It swaps the chart out; the owner keeps the chart visible, and 0016 rejected the same.
- **Renaming the "Show as" stage legend instead of the switch.** "Show as" is live on published pages; "Show as table" was deployed nowhere.
- **A `table` slot on `Board`.** It puts layout into the frame 0013 keeps simple, when a tray item does the job.
- **Folding VectorBoard2D's table with its steppers inside.** It hides the keyboard path 0014 relies on.
- **Each board passing its own switch label or opening sentence.** Copies of a sentence that must never differ.
- **Remembering the open state across pages.** Not needed, and it would make Reset's "back to the opening view" untrue.
- **Using the fold as the spoiler fix for `class-box` and `marks-scaling`.** A fold prints and opens; the answers stay unrendered by board state instead (0015).
