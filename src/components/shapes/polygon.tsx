import { PolygonSchemaType } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function PolygonShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: PolygonSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  const points = obj.points
    .map((p) => {
      const { sx, sy } = toScreen(p.x, p.y);
      return `${sx},${sy}`;
    })
    .join(" ");

  return <polygon points={points} {...shapePaint(obj, zoom)} />;
}
