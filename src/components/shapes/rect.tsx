import type { RectObject, ToScreen } from "./types";

export default function RectShape({
  obj,
  toScreen,
}: {
  obj: RectObject;
  toScreen: ToScreen;
}) {
  const w = obj.w ?? 24;
  const h = obj.h ?? 24;
  const { sx, sy } = toScreen(obj.x, obj.y);
  return <rect x={sx} y={sy - h} width={w} height={h} fill={obj.color} />;
}
