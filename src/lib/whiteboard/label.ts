import { objectBounds } from "./geometry";
import { StoredObjectSchemaType } from "./schemas";

export const LABEL_FONT = 14;
export const LABEL_COLOR = "#1f241c";
export const LABEL_BACKGROUND = "#fbfbf8";

let measure: CanvasRenderingContext2D | null | undefined;

function measureWidth(text: string, fontSize: number) {
  if (measure === undefined && typeof document !== "undefined") {
    measure = document.createElement("canvas").getContext("2d");
  }
  if (measure) {
    measure.font = `${fontSize}px Helvetica, Arial, sans-serif`;
    return measure.measureText(text).width;
  }
  return text.length * fontSize * 0.56;
}

export function labelMetrics(text: string, fontSize = LABEL_FONT) {
  return { w: Math.max(measureWidth(text, fontSize), 1), h: fontSize };
}

// labelX/labelY place the label center on the object box.
// 0 is the left or bottom edge, 1 is the right or top edge, 0.5 is the middle.
// The center may sit slightly outside 0..1 so the text can hang off an edge.
export function labelPlacement(obj: StoredObjectSchemaType, text: string) {
  const bounds = objectBounds(obj);
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const fontSize = obj.labelFontSize != null && obj.labelFontSize > 0 ? obj.labelFontSize : LABEL_FONT;
  const size = labelMetrics(text, fontSize);
  let cx = bounds.minX + (obj.labelX ?? 0.5) * spanX;
  let cy = bounds.minY + (obj.labelY ?? 0.5) * spanY;
  cx = Math.min(bounds.maxX + size.w / 2, Math.max(bounds.minX - size.w / 2, cx));
  cy = Math.min(bounds.maxY + size.h / 2, Math.max(bounds.minY - size.h / 2, cy));
  return {
    cx,
    cy,
    w: size.w,
    h: size.h,
    labelX: (cx - bounds.minX) / spanX,
    labelY: (cy - bounds.minY) / spanY,
  };
}
