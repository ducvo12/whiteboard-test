import { ArrowSchemaType } from "@/lib/whiteboard/schemas";
import type { ToScreen } from "./other-types";

export default function ArrowShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: ArrowSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  const tail = toScreen(obj.x, obj.y);
  const head = toScreen(obj.x2, obj.y2);
  const len = Math.hypot(head.sx - tail.sx, head.sy - tail.sy) || 1;
  const size = Math.min(16 * zoom, len * 0.45);
  const angle = Math.atan2(head.sy - tail.sy, head.sx - tail.sx);
  const base = {
    sx: head.sx - size * Math.cos(angle),
    sy: head.sy - size * Math.sin(angle),
  };
  const wing = size * 0.55;
  const left = {
    sx: base.sx + wing * Math.sin(angle),
    sy: base.sy - wing * Math.cos(angle),
  };
  const right = {
    sx: base.sx - wing * Math.sin(angle),
    sy: base.sy + wing * Math.cos(angle),
  };

  return (
    <g>
      <line
        x1={tail.sx}
        y1={tail.sy}
        x2={base.sx}
        y2={base.sy}
        stroke={obj.strokeColor}
        strokeWidth={obj.strokeWidth}
      />
      <polygon
        points={`${head.sx},${head.sy} ${left.sx},${left.sy} ${right.sx},${right.sy}`}
        fill={obj.strokeColor}
      />
    </g>
  );
}
