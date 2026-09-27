import { objectBounds } from "@/lib/whiteboard/geometry";
import { LABEL_BACKGROUND, LABEL_COLOR, labelPlacement } from "@/lib/whiteboard/label";
import { StoredObjectSchemaType } from "@/lib/whiteboard/schemas";
import ArrowShape from "./arrow";
import CircleShape from "./circle";
import PolygonShape from "./polygon";
import RectShape from "./rect";
import TextboxShape from "./textbox";
import type { ToScreen } from "./other-types";

export default function BoardShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: StoredObjectSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  let shape;
  switch (obj.object) {
    case "circle":
      shape = <CircleShape obj={obj} toScreen={toScreen} zoom={zoom} />;
      break;
    case "rect":
      shape = <RectShape obj={obj} toScreen={toScreen} zoom={zoom} />;
      break;
    case "polygon":
      shape = <PolygonShape obj={obj} toScreen={toScreen} zoom={zoom} />;
      break;
    case "arrow":
      shape = <ArrowShape obj={obj} toScreen={toScreen} zoom={zoom} />;
      break;
    case "textbox":
      shape = <TextboxShape obj={obj} toScreen={toScreen} zoom={zoom} />;
      break;
  }
  const bounds = objectBounds(obj);
  const center = toScreen((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const text = obj.label?.trim();
  const place = text ? labelPlacement(obj, text) : null;
  const labelAt = place ? toScreen(place.cx, place.cy) : null;
  return (
    <g transform={`rotate(${-(obj.rotation ?? 0)} ${center.sx} ${center.sy})`}>
      {shape}
      {place && labelAt && (
        <g>
          <rect
            x={labelAt.sx - (place.w * zoom) / 2}
            y={labelAt.sy - (place.h * zoom) / 2}
            width={place.w * zoom}
            height={place.h * zoom}
            rx={3}
            fill={obj.labelBackground || LABEL_BACKGROUND}
            stroke="#e3e5dc"
          />
          <text
            x={labelAt.sx}
            y={labelAt.sy}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize={place.h * zoom}
            fill={obj.labelColor || LABEL_COLOR}
          >
            {text}
          </text>
        </g>
      )}
    </g>
  );
}
