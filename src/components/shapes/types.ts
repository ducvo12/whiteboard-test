export type BoardObjectBase = {
  id: string;
  color: string;
  x: number;
  y: number;
};

export type CircleObject = BoardObjectBase & {
  shape: "circle";
  r?: number;
};

export type RectObject = BoardObjectBase & {
  shape: "rect";
  w?: number;
  h?: number;
};

export type PolygonObject = BoardObjectBase & {
  shape: "polygon";
  /** World-space vertices. `x`/`y` on the object should match `points[0]`. */
  points: { x: number; y: number }[];
};

export type BoardObject = CircleObject | RectObject | PolygonObject;

export type ToScreen = (x: number, y: number) => { sx: number; sy: number };
