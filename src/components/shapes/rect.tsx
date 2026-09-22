import { RectSchemaType } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function RectShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: RectSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return (
    <rect
      x={sx}
      y={sy - obj.h * zoom}
      width={obj.w * zoom}
      height={obj.h * zoom}
      {...shapePaint(obj, zoom)}
    />
  );
}
