import type { CircleObject, ToScreen } from "./types";

export default function CircleShape({
  obj,
  toScreen,
}: {
  obj: CircleObject;
  toScreen: ToScreen;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return <circle cx={sx} cy={sy} r={obj.r ?? 12} fill={obj.color} />;
}
