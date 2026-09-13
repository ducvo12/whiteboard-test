import { CircleSchemaValue } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function CircleShape({
  obj,
  toScreen,
}: {
  obj: CircleSchemaValue;
  toScreen: ToScreen;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return <circle cx={sx} cy={sy} r={obj.r} {...shapePaint(obj)} />;
}
