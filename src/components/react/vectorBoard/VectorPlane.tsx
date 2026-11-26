import { useMemo } from "react";
import { Circle, Coordinates, Mafs, MovablePoint, Plot, Polygon, Polyline, Text, Vector } from "mafs";
import type { vec } from "mafs";
import { DOTTED, Segment } from "../planeLines";
import { plotColors } from "../plotColors";
import { cornerDots, drawnMeasures } from "./normsDescribe.ts";
import { ballOutline, type Measure } from "./norms.ts";
import { ARC_RADIUS, cartShadow, combinePieces, handlesFor, ochreElement, showsArc, showsRightAngle, spanLine, sumDot, type TableRow } from "./describe.ts";
import {
  ARROW_WEIGHT,
  GUESS_RING_RADIUS,
  MUTED_WEIGHT,
  OCHRE_WEIGHT,
  SPAN_LINE_WEIGHT,
  SUM_DOT_RADIUS,
  TARGET_RING_RADIUS,
  ZERO_RING_RADIUS,
  placedLabels,
} from "./labelLayout.ts";
import {
  LABEL_SIZE,
  VIEW_LIMIT,
  VIEW_PADDING,
  add,
  clipSegment,
  combine,
  cross,
  isZero,
  lengthSquared,
  numberText,
  scale,
  shadowTip,
  snapInto,
  spanKind,
  subtract,
  type Vec2,
} from "./model.ts";
import { handleBox, handleIds, requireFlag, setupOf, type HandleId, type VectorState } from "./state.ts";

const VIEW: vec.Vector2 = [-(VIEW_LIMIT + VIEW_PADDING), VIEW_LIMIT + VIEW_PADDING];
const RIGHT_ANGLE_SIZE = 0.3;

interface VectorPlaneProps {
  state: VectorState;
  /** The table row the reader is pointing at: its arrow gets dotted component legs. */
  linkedId: TableRow["id"] | null;
  /** Height of the square plane in pixels (Mafs fills the width). */
  size: number;
  onMove: (handle: HandleId, point: Vec2) => void;
}

const unit = (v: Vec2): Vec2 => scale(1 / Math.sqrt(lengthSquared(v)), v);

/** An arrow, or a labeled ring for a zero vector: Mafs would point a zero-length arrow's head east. */
function Arrow({ tail = [0, 0], tip, color = plotColors.ink, weight = ARROW_WEIGHT, dashed = false }: { tail?: Vec2; tip: Vec2; color?: string; weight?: number; dashed?: boolean }) {
  if (isZero(subtract(tip, tail))) return <Circle center={[tail[0], tail[1]]} radius={ZERO_RING_RADIUS} color={color} fillOpacity={0} weight={2} />;
  return <Vector tail={[tail[0], tail[1]]} tip={[tip[0], tip[1]]} color={color} weight={weight} style={dashed ? "dashed" : "solid"} />;
}

/** A small open square at `corner`, with sides along the two unit directions. */
function RightAngle({ corner, first, second }: { corner: Vec2; first: Vec2; second: Vec2 }) {
  const one = add(corner, scale(RIGHT_ANGLE_SIZE, first));
  const both = add(one, scale(RIGHT_ANGLE_SIZE, second));
  const two = add(corner, scale(RIGHT_ANGLE_SIZE, second));
  return (
    <Polyline
      points={[
        [one[0], one[1]],
        [both[0], both[1]],
        [two[0], two[1]],
      ]}
      color={plotColors.inkMuted}
      weight={1.5}
      fillOpacity={0}
    />
  );
}

/** One dotted leg, cut at the board's edge (span-reach's arrows can run past it); nothing when no part is on the board. */
function Leg({ from, to }: { from: Vec2; to: Vec2 }) {
  const piece = clipSegment(from, to);
  return piece && <Segment from={piece.from} to={piece.to} color={plotColors.inkMuted} weight={2} lineStyle="dotted" />;
}

/** Dotted legs from the tail east or west, then north or south, for the row the reader is pointing at. */
function ComponentLegs({ tail, tip }: { tail: Vec2; tip: Vec2 }) {
  const corner: Vec2 = [tip[0], tail[1]];
  return (
    <>
      <Leg from={tail} to={corner} />
      <Leg from={corner} to={tip} />
    </>
  );
}

/** Where a table row's arrow starts and ends, for its component legs. */
function rowArrow(state: VectorState, id: TableRow["id"]): { tail: Vec2; tip: Vec2 } | null {
  const origin: Vec2 = [0, 0];
  const kind = setupOf(state).kind;
  switch (id) {
    case "guess":
      return null;
    case "a":
      return { tail: origin, tip: state.a };
    case "b":
      return kind === "add" ? { tail: state.a, tip: add(state.a, state.b) } : { tail: origin, tip: state.b };
    case "sum":
      return { tail: origin, tip: add(state.a, state.b) };
    case "scaled":
      return { tail: origin, tip: scale(state.scalar, state.a) };
    case "scaledB":
      return { tail: scale(state.scalar, state.a), tip: combine(state.scalar, state.a, state.scalarD, state.b) };
    case "combo":
      return { tail: origin, tip: combine(state.scalar, state.a, state.scalarD, state.b) };
    case "track":
      return { tail: origin, tip: state.b };
  }
}

/** Which element is ochre comes only from ochreElement (describe.ts), so there is never more than one. */
interface SceneProps {
  state: VectorState;
  ochre: ReturnType<typeof ochreElement>;
}

const ochreOr = (on: boolean) => (on ? plotColors.attention : plotColors.ink);

function AddScene({ state, ochre }: SceneProps) {
  const sum = add(state.a, state.b);
  return (
    <>
      {state.otherOrder && (
        <>
          <Arrow tip={state.b} color={plotColors.inkMuted} dashed />
          <Arrow tail={state.b} tip={sum} color={plotColors.inkMuted} dashed />
        </>
      )}
      <Arrow tip={state.a} />
      <Arrow tail={state.a} tip={sum} dashed />
      {state.checked ? (
        <Arrow tip={sum} color={ochreOr(ochre === "sum")} weight={OCHRE_WEIGHT} />
      ) : (
        <Circle center={[state.guess[0], state.guess[1]]} radius={GUESS_RING_RADIUS} color={ochreOr(ochre === "guess")} fillOpacity={0} weight={OCHRE_WEIGHT} />
      )}
    </>
  );
}

function ScaleScene({ state, ochre }: SceneProps) {
  const scaled = scale(state.scalar, state.a);
  return (
    <>
      <Arrow tip={state.a} />
      {!isZero(state.a) && <Arrow tip={scaled} color={ochreOr(ochre === "scaled")} weight={OCHRE_WEIGHT} />}
    </>
  );
}

function CartScene({ state, ochre }: SceneProps) {
  const goal = setupOf(state).goal;
  const shadow = cartShadow(state);
  const railsShown = shadow !== null && shadow.onBoard && cross(state.b, state.a) !== 0;
  return (
    <>
      {goal && (
        <Circle center={[0, 0]} radius={Math.sqrt(goal.targetLengthSquared)} color={plotColors.inkMuted} fillOpacity={0} weight={1.5} svgEllipseProps={{ style: DOTTED }} />
      )}
      <Arrow tip={state.b} dashed />
      <Arrow tip={state.a} />
      {shadow && (
        <>
          {!isZero(shadow.tip) && <Segment from={[0, 0]} to={shadow.tip} color={ochreOr(ochre === "shadow")} weight={OCHRE_WEIGHT} />}
          {railsShown && <Segment from={shadow.tip} to={state.a} color={plotColors.inkMuted} weight={2} lineStyle="dotted" />}
          {railsShown && !isZero(shadow.tip) && (
            <RightAngle corner={shadow.tip} first={unit(scale(-1, shadow.tip))} second={unit(subtract(state.a, shadow.tip))} />
          )}
        </>
      )}
    </>
  );
}

function AlignScene({ state, ochre }: SceneProps) {
  const { a, b } = state;
  const tip = state.checked ? shadowTip(a, b) : null;
  const start = Math.atan2(a[1], a[0]);
  const turn = Math.sign(cross(a, b));
  const angle = isZero(a) || isZero(b) ? 0 : Math.atan2(Math.abs(cross(a, b)), a[0] * b[0] + a[1] * b[1]);
  return (
    <>
      <Arrow tip={a} />
      <Arrow tip={b} dashed />
      {tip && !isZero(tip) && (
        <>
          <Segment from={[0, 0]} to={tip} color={ochreOr(ochre === "shadow")} weight={OCHRE_WEIGHT} />
          {cross(a, b) !== 0 && <Segment from={tip} to={b} color={plotColors.inkMuted} weight={2} lineStyle="dotted" />}
        </>
      )}
      {showsArc(state) && (
        <Plot.Parametric
          xy={(t) => [ARC_RADIUS * Math.cos(start + turn * t), ARC_RADIUS * Math.sin(start + turn * t)]}
          domain={[0, angle]}
          color={plotColors.inkMuted}
          weight={1.5}
        />
      )}
      {showsRightAngle(state) && <RightAngle corner={[0, 0]} first={unit(a)} second={unit(b)} />}
    </>
  );
}

/** a and b are muted references on span-reach, but a zero one is the ink "zero vector" ring every setup draws. */
const referenceColor = (vector: Vec2) => (isZero(vector) ? plotColors.ink : plotColors.inkMuted);

/**
 * span-reach: muted a and b, then c a and d b in ink, each cut at the board's edge (a cut arrow loses its head, since a
 * head at the edge would claim the vector ends there), the sum dot, and the ochre flag. After Check, a muted dotted
 * span line when a and b line up.
 */
function CombineScene({ state, ochre }: SceneProps) {
  const target = requireFlag(setupOf(state)).target;
  const line = spanLine(state);
  const dot = sumDot(state);
  return (
    <>
      {line && <Segment from={line[0]} to={line[1]} color={plotColors.inkMuted} weight={SPAN_LINE_WEIGHT} lineStyle="dotted" />}
      <Arrow tip={state.a} color={referenceColor(state.a)} weight={MUTED_WEIGHT} />
      <Arrow tip={state.b} color={referenceColor(state.b)} weight={MUTED_WEIGHT} dashed />
      {combinePieces(state).map((piece) =>
        piece.head ? (
          <Arrow key={piece.id} tail={piece.from} tip={piece.to} dashed={piece.id === "scaledB"} />
        ) : (
          <Segment key={piece.id} from={piece.from} to={piece.to} color={plotColors.ink} weight={ARROW_WEIGHT} lineStyle={piece.id === "scaledB" ? "dashed" : "solid"} />
        ),
      )}
      {dot && <Circle center={[dot[0], dot[1]]} radius={SUM_DOT_RADIUS} color={plotColors.ink} fillOpacity={1} weight={1} />}
      <Circle center={[target[0], target[1]]} radius={TARGET_RING_RADIUS} color={ochreOr(ochre === "flag")} fillOpacity={0} weight={OCHRE_WEIGHT} />
    </>
  );
}

/**
 * span-shape: a and b as on align. After Check the span is ochre: a solid line edge to edge when it is a line, a ring
 * at the origin when it is only the origin, and nothing for the whole plane, which is said in words. The line is drawn
 * first, so b's dashes stay on top of it.
 */
function SpanScene({ state, ochre }: SceneProps) {
  const line = spanLine(state);
  const originRing = ochre === "span" && spanKind(state.a, state.b) === "origin";
  return (
    <>
      {line && <Segment from={line[0]} to={line[1]} color={ochreOr(ochre === "span")} weight={OCHRE_WEIGHT} />}
      {originRing && <Circle center={[0, 0]} radius={TARGET_RING_RADIUS} color={plotColors.attention} fillOpacity={0} weight={OCHRE_WEIGHT} />}
      <Arrow tip={state.a} />
      <Arrow tip={state.b} dashed />
    </>
  );
}

/** The small muted dots on the whole-number corners of the drawn shape. */
const CORNER_DOT_RADIUS = 0.1;
const BALL_WEIGHT = 2;

/** One ball outline. The dash pattern names the measure (diamond solid, circle dashed, square dotted) in every color. */
function Ball({ measure, radius, color, weight }: { measure: Measure; radius: number; color: string; weight: number }) {
  const outline = ballOutline(measure, radius);
  if (outline.kind === "circle") return <Circle center={[0, 0]} radius={outline.radius} color={color} fillOpacity={0} weight={weight} strokeStyle="dashed" />;
  return (
    <Polygon
      points={outline.points.map((point): vec.Vector2 => [point[0], point[1]])}
      color={color}
      fillOpacity={0}
      weight={weight}
      svgPolygonProps={measure === "linf" ? { style: DOTTED } : undefined}
    />
  );
}

/**
 * city-walk: the pin's arrow v from home, the walking route as a dotted staircase (east leg, then north leg), ochre
 * before Check. After Check the shapes for the chosen measure, ochre when there is one, ink for "All three", and the
 * shape's whole-number corners as muted dots.
 */
function NormsScene({ state, ochre }: SceneProps) {
  const pin = state.a;
  const corner: Vec2 = [pin[0], 0];
  const routeOchre = ochre === "route";
  const route = { color: routeOchre ? plotColors.attention : plotColors.inkMuted, weight: routeOchre ? OCHRE_WEIGHT : BALL_WEIGHT };
  const ballOchre = ochre === "ball";
  return (
    <>
      {drawnMeasures(state).map((measure) => (
        <Ball key={measure} measure={measure} radius={state.radius} color={ochreOr(ballOchre)} weight={ballOchre ? OCHRE_WEIGHT : BALL_WEIGHT} />
      ))}
      {cornerDots(state).map((dot) => (
        <Circle key={`${dot[0]},${dot[1]}`} center={[dot[0], dot[1]]} radius={CORNER_DOT_RADIUS} color={plotColors.inkMuted} fillOpacity={1} weight={1} />
      ))}
      {pin[0] !== 0 && <Segment from={[0, 0]} to={corner} color={route.color} weight={route.weight} lineStyle="dotted" />}
      {pin[1] !== 0 && <Segment from={corner} to={pin} color={route.color} weight={route.weight} lineStyle="dotted" />}
      <Arrow tip={pin} />
    </>
  );
}

const SCENES = { add: AddScene, scale: ScaleScene, cart: CartScene, align: AlignScene, combine: CombineScene, "span-choice": SpanScene, norms: NormsScene } as const;

/**
 * The Mafs plane: whole-number grid, ink arrows told apart by label and line style (a solid, b dashed), and one
 * ochre element (ochreElement in describe.ts). Handles are ink dots that snap to the grid, so one arrow-key press
 * is one grid unit. Mafs code only; every string comes from describe.ts.
 */
export default function VectorPlane({ state, linkedId, size, onMove }: VectorPlaneProps) {
  const kind = setupOf(state).kind;
  const Scene = SCENES[kind];
  const trips = state.stage === "trips";
  const handles = handlesFor(state);
  const linked = linkedId ? rowArrow(state, linkedId) : null;
  // One constraint per handle: round to the grid, then clamp to the handle's box (never a hole; see model.ts).
  const constraints = useMemo(() => {
    const constrainTo = (id: HandleId) => (point: vec.Vector2): vec.Vector2 => {
      const [x, y] = snapInto(point, handleBox(state, id));
      return [x, y];
    };
    return Object.fromEntries(handleIds(state).map((id) => [id, constrainTo(id)])) as Partial<Record<HandleId, (point: vec.Vector2) => vec.Vector2>>;
  }, [state]);
  // One move handler per handle. handleIds returns the same array while the handles stay the same, so a drag
  // doesn't rebuild them.
  const ids = handleIds(state);
  const moveHandlers = useMemo(
    () => Object.fromEntries(ids.map((id) => [id, (point: vec.Vector2) => onMove(id, point)])) as Partial<Record<HandleId, (point: vec.Vector2) => void>>,
    [ids, onMove],
  );
  const axis = trips ? { lines: 1, labels: false as const } : { lines: 1, labels: (n: number) => numberText(n) };

  return (
    <Mafs height={size} viewBox={{ x: VIEW, y: VIEW, padding: 0 }} pan={false} zoom={false}>
      {/* The drawing, axis numbers and labels are hidden from screen readers: the readouts, steppers and table say the
          same in words. Only the named handles below stay exposed. */}
      <g aria-hidden="true">
        <Coordinates.Cartesian xAxis={axis} yAxis={axis} />
        {linked && !isZero(subtract(linked.tip, linked.tail)) && <ComponentLegs tail={linked.tail} tip={linked.tip} />}
        <Scene state={state} ochre={ochreElement(state)} />
        {/* Kept inside the plane at this size, and on the span setups clear of each other, the arrows and the axis numbers (labelLayout.ts). */}
        {placedLabels(state, size).map((label) => (
          <Text key={label.id} x={label.at[0]} y={label.at[1]} size={LABEL_SIZE} color={plotColors.ink} attach={label.attach === "center" ? undefined : label.attach}>
            {label.text}
          </Text>
        ))}
      </g>
      {handles.map((handle) => {
        const handleMove = moveHandlers[handle.id];
        if (!handleMove) throw new Error(`VectorBoard2D: handle "${handle.id}" has no move handler.`);
        return (
          <MovablePoint
            key={handle.id}
            point={[handle.point[0], handle.point[1]]}
            constrain={constraints[handle.id]}
            onMove={handleMove}
            color={plotColors.ink}
          />
        );
      })}
    </Mafs>
  );
}
