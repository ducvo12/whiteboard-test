import { shapePaint, type CircleObject, type ToScreen } from "./types";

export default function CircleShape({
  obj,
  toScreen,
}: {
  obj: CircleObject;
  toScreen: ToScreen;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  return <circle cx={sx} cy={sy} r={obj.r} {...shapePaint(obj)} />;
}
