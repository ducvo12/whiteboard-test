export type BoardObject = CircleObject | RectObject | PolygonObject

export type ShapeBase = {
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  fillColor: string;
  /** 0–1. Defaults to 1 when omitted. */
  fillOpacity?: number;
  strokeWidth: number;
};

export type CircleObject = ShapeBase & {
  shape: "circle";
  r: number;
};

export type RectObject = ShapeBase & {
  shape: "rect";
  w: number;
  h: number;
};

export type PolygonObject = ShapeBase & {
  shape: "polygon";
  /** World-space vertices. `x`/`y` on the object should match `points[0]`. */
  points: { x: number; y: number }[];
};

export type ToScreen = (x: number, y: number) => { sx: number; sy: number };

export function shapePaint(obj: ShapeBase) {
  return {
    fill: obj.fillColor,
    fillOpacity: obj.fillOpacity ?? 1,
    stroke: obj.strokeColor,
    strokeWidth: obj.strokeWidth,
  };
}
