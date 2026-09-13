import type { PolygonObject, ToScreen } from "./types";

export default function PolygonShape({
  obj,
  toScreen,
}: {
  obj: PolygonObject;
  toScreen: ToScreen;
}) {
  const points = obj.points
    .map((p) => {
      const { sx, sy } = toScreen(p.x, p.y);
      return `${sx},${sy}`;
    })
    .join(" ");

  return <polygon points={points} fill={obj.color} />;
}
