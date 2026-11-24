import { useMemo } from "react";
import { Circle, Coordinates, Mafs, MovablePoint, Plot, Polyline, Text, Vector } from "mafs";
import type { vec } from "mafs";
import { plotColors } from "../plotColors";
import { ARC_RADIUS, cartShadow, handlesFor, ochreElement, planeLabels, showsArc, showsRightAngle, type TableRow } from "./describe.ts";
import { VIEW_LIMIT, VIEW_PADDING, add, cross, isZero, lengthSquared, numberText, scale, shadowTip, snapInto, subtract, type Vec2 } from "./model.ts";
import { handleBox, handleIds, setupOf, type HandleId, type VectorState } from "./state.ts";

const VIEW: vec.Vector2 = [-(VIEW_LIMIT + VIEW_PADDING), VIEW_LIMIT + VIEW_PADDING];
const ARROW_WEIGHT = 2.5;
/** The one ochre element is heavier, so it stands out by weight as well as hue. */
const OCHRE_WEIGHT = 3;
const LABEL_SIZE = 16;
const ZERO_RING_RADIUS = 0.2;
const GUESS_RING_RADIUS = 0.32;
const RIGHT_ANGLE_SIZE = 0.3;
const DOTTED = { strokeDasharray: "1 5", strokeLinecap: "round" } as const;

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

/** A plain line, dotted or solid, with no arrowhead. */
function Segment({ from, to, color, weight, dotted = false }: { from: Vec2; to: Vec2; color: string; weight: number; dotted?: boolean }) {
  return (
    <Polyline
      points={[
        [from[0], from[1]],
        [to[0], to[1]],
      ]}
      color={color}
      weight={weight}
      fillOpacity={0}
      svgPolylineProps={dotted ? { style: DOTTED } : undefined}
    />
  );
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

/** Dotted legs from the tail east or west, then north or south, for the row the reader is pointing at. */
function ComponentLegs({ tail, tip }: { tail: Vec2; tip: Vec2 }) {
  const corner: Vec2 = [tip[0], tail[1]];
  return (
    <>
      <Segment from={tail} to={corner} color={plotColors.inkMuted} weight={2} dotted />
      <Segment from={corner} to={tip} color={plotColors.inkMuted} weight={2} dotted />
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
          {railsShown && <Segment from={shadow.tip} to={state.a} color={plotColors.inkMuted} weight={2} dotted />}
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
          {cross(a, b) !== 0 && <Segment from={tip} to={b} color={plotColors.inkMuted} weight={2} dotted />}
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

const SCENES = { add: AddScene, scale: ScaleScene, cart: CartScene, align: AlignScene } as const;

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
      <Coordinates.Cartesian xAxis={axis} yAxis={axis} />
      {linked && !isZero(subtract(linked.tip, linked.tail)) && <ComponentLegs tail={linked.tail} tip={linked.tip} />}
      <Scene state={state} ochre={ochreElement(state)} />
      {planeLabels(state).map((label) => (
        <Text key={label.id} x={label.at[0]} y={label.at[1]} size={LABEL_SIZE} color={plotColors.ink}>
          {label.text}
        </Text>
      ))}
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
