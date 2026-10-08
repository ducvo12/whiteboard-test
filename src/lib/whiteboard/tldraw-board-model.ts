import type { BoardObjectSchemaType, StoredObjectSchemaType } from "./schemas";
import { objectBounds } from "./geometry.ts";
import type { TLDefaultColorStyle, TLDefaultSizeStyle, TLDefaultFillStyle, TLDefaultDashStyle, TLShape } from "tldraw";

declare module "tldraw" {
  interface TLGlobalShapePropsMap { "board-object": ExactBoardProps }
}
export type ExactBoardShape = TLShape<"board-object">;

export type ExactBoardProps = { w: number; h: number; data: string; color: TLDefaultColorStyle; size: TLDefaultSizeStyle; fill: TLDefaultFillStyle; dash: TLDefaultDashStyle };
export function boardBounds(object: BoardObjectSchemaType) {
  return objectBounds({ ...object, id: "geometry" } as StoredObjectSchemaType);
}
export function boardProps(object: BoardObjectSchemaType): ExactBoardProps {
  const b = boardBounds(object);
  const data = { ...object } as BoardObjectSchemaType & { id?: string };
  delete data.id;
  return { color: "green", size: "s", fill: "solid", dash: "solid", w: Math.max(b.maxX - b.minX, 1), h: Math.max(b.maxY - b.minY, 1), data: JSON.stringify(data) };
}
export function boardPosition(object: BoardObjectSchemaType) {
  const b = boardBounds(object), { w, h } = boardProps(object);
  const rotation = -object.rotation * Math.PI / 180;
  const cx = (b.minX + b.maxX) / 2, cy = -(b.minY + b.maxY) / 2;
  return { x: cx - (w * Math.cos(rotation) - h * Math.sin(rotation)) / 2,
    y: cy - (w * Math.sin(rotation) + h * Math.cos(rotation)) / 2, rotation };
}
/** Materialize a resized shape in a local Y-up coordinate system (top-left = 0,0). */
export function localBoardObject(props: ExactBoardProps): BoardObjectSchemaType {
  const object = JSON.parse(props.data) as BoardObjectSchemaType;
  const b = boardBounds(object), sx = props.w / Math.max(b.maxX - b.minX, 1), sy = props.h / Math.max(b.maxY - b.minY, 1);
  const point = (x: number, y: number) => ({ x: (x - b.minX) * sx, y: (y - b.maxY) * sy });
  const base = { ...object, ...point(object.x, object.y), rotation: 0 };
  if (object.object === "polygon") return { ...base, object: "polygon", points: object.points.map((p) => point(p.x, p.y)) };
  if (object.object === "arrow") { const end = point(object.x2, object.y2); return { ...base, object: "arrow", x2: end.x, y2: end.y }; }
  if (object.object === "circle") return { ...base, object: "circle", r: object.r * sx };
  return { ...base, object: object.object, w: object.w * sx, h: object.h * sy } as BoardObjectSchemaType;
}
export function exactShapeObject(props: ExactBoardProps, center: { x: number; y: number }, rotation: number): BoardObjectSchemaType {
  const local = localBoardObject(props);
  const dx = center.x - props.w / 2, dy = -center.y + props.h / 2;
  const degrees = -rotation * 180 / Math.PI;
  const base = { ...local, x: local.x + dx, y: local.y + dy, rotation: ((degrees % 360 + 360) % 360) || 0 };
  if (local.object === "polygon") return { ...base, object: "polygon", points: local.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  if (local.object === "arrow") return { ...base, object: "arrow", x2: local.x2 + dx, y2: local.y2 + dy };
  return base as BoardObjectSchemaType;
}
