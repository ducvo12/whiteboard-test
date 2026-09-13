import { RectSchemaValue } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function RectShape({
  obj,
  toScreen,
}: {
  obj: RectSchemaValue;
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
