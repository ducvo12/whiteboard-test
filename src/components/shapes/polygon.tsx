import { PolygonSchemaValue } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function PolygonShape({
  obj,
  toScreen,
}: {
  obj: PolygonSchemaValue;
  toScreen: ToScreen;
}) {
  const points = obj.points
    .map((p) => {
      const { sx, sy } = toScreen(p.x, p.y);
      return `${sx},${sy}`;
    })
    .join(" ");

  return <polygon points={points} {...shapePaint(obj)} />;
}
