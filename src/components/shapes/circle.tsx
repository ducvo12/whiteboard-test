import { CircleSchemaValue } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function CircleShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: CircleSchemaValue;
  toScreen: ToScreen;
  zoom: number;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return <circle cx={sx} cy={sy} r={obj.r * zoom} {...shapePaint(obj, zoom)} />;
}
