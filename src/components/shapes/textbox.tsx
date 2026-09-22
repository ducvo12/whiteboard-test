import { TextboxSchemaType } from "@/lib/whiteboard/schemas";
import { shapePaint, type ToScreen } from "./other-types";

export default function TextboxShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: TextboxSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  const { sx, sy } = toScreen(obj.x, obj.y);
  const width = obj.w * zoom;
  const height = obj.h * zoom;
  const padding = Math.min(8, obj.fontSize * 0.35) * zoom;

  return (
    <g pointerEvents="none">
      <rect
        x={sx}
        y={sy - height}
        width={width}
        height={height}
        {...shapePaint(obj, zoom)}
      />
      <foreignObject x={sx} y={sy - height} width={width} height={height}>
        <div
          style={{
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            padding: `${padding}px`,
            color: obj.textColor,
            fontSize: `${obj.fontSize * zoom}px`,
            lineHeight: 1.3,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {obj.text}
        </div>
      </foreignObject>
    </g>
  );
}
