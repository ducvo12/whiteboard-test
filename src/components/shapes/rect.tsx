import { shapePaint, type RectObject, type ToScreen } from "./types";

export default function RectShape({
  obj,
  toScreen,
}: {
  obj: RectObject;
  toScreen: ToScreen;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return (
    <rect
      x={sx}
      y={sy - obj.h}
      width={obj.w}
      height={obj.h}
      {...shapePaint(obj)}
    />
  );
}
