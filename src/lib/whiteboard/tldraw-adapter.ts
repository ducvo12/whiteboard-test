import { createShapeId, getArrowBindings, getArrowTerminalsInArrowSpace, renderPlaintextFromRichText, toRichText, type Editor, type TLDefaultColorStyle, type TLDefaultSizeStyle, type TLShape, type TLShapePartial } from "tldraw";
import type { BoardObjectSchemaType, StoredObjectSchemaType } from "./schemas";

const colors: Record<TLDefaultColorStyle, string> = {
  white: "#ffffff",
  black: "#1d1d1d", grey: "#9fa8b2", "light-violet": "#e085f4", violet: "#ae3ec9",
  blue: "#4465e9", "light-blue": "#4ba1f1", yellow: "#f1ac4b", orange: "#e16919",
  green: "#099268", "light-green": "#4cb05e", "light-red": "#f87777", red: "#e03131",
};
const widths = { s: 2, m: 3.5, l: 5, xl: 10 };
const fonts = { s: 18, m: 24, l: 36, xl: 44 };
function color(value: string): TLDefaultColorStyle {
  value = value.trim().toLowerCase();
  if (value in colors) return value as TLDefaultColorStyle;
  const named: Record<string, string> = { gray: "#808080", navy: "#000080", purple: "#800080", pink: "#ffc0cb", lime: "#00ff00", teal: "#008080", cyan: "#00ffff", brown: "#a52a2a", olive: "#808000" };
  value = named[value] ?? value;
  if (/^#[\da-f]{3}$/i.test(value)) value = "#" + [...value.slice(1)].map((c) => c + c).join("");
  const rgb = /^#[\da-f]{6}$/i.test(value) ? [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) : [29, 29, 29];
  return (Object.keys(colors) as TLDefaultColorStyle[]).sort((a, b) => {
    const distance = (key: TLDefaultColorStyle) => [1, 3, 5].reduce((sum, i, j) => sum + (parseInt(colors[key].slice(i, i + 2), 16) - rgb[j]) ** 2, 0);
    return distance(a) - distance(b);
  })[0];
}
function size(value: number, choices = widths): TLDefaultSizeStyle {
  return (Object.keys(choices) as TLDefaultSizeStyle[]).sort((a, b) => Math.abs(choices[a] - value) - Math.abs(choices[b] - value))[0];
}

export function shapeId(id: string) { return id.startsWith("shape:") ? id as TLShape["id"] : createShapeId(id); }
export function objectToShape(obj: StoredObjectSchemaType): TLShapePartial | null {
  if (obj.object === "polygon") return null;
  const rotation = -obj.rotation * Math.PI / 180;
  const common = { id: shapeId(obj.id), rotation, meta: { boardId: obj.id, boardKind: obj.object } };
  const style = { color: color(obj.strokeColor), size: size(obj.strokeWidth), dash: "solid" as const, fill: obj.fillColor === "transparent" || obj.fillOpacity === 0 ? "none" as const : "solid" as const };
  if (obj.object === "arrow") {
    const dx = obj.x2 - obj.x, dy = -(obj.y2 - obj.y);
    const cx = (obj.x + obj.x2) / 2, cy = -(obj.y + obj.y2) / 2;
    return { ...common, type: "arrow", x: cx - (dx * Math.cos(rotation) - dy * Math.sin(rotation)) / 2,
      y: cy - (dx * Math.sin(rotation) + dy * Math.cos(rotation)) / 2,
      props: { ...style, start: { x: 0, y: 0 }, end: { x: dx, y: dy }, bend: 0, kind: "arc", richText: toRichText(obj.label ?? ""), labelColor: color(obj.labelColor ?? obj.strokeColor) } };
  }
  const w = obj.object === "circle" ? obj.r * 2 : obj.w;
  const h = obj.object === "circle" ? obj.r * 2 : obj.h;
  const cx = obj.object === "circle" ? obj.x : obj.x + w / 2;
  const cy = obj.object === "circle" ? -obj.y : -obj.y - h / 2;
  return { ...common, type: "geo", x: cx - (w * Math.cos(rotation) - h * Math.sin(rotation)) / 2,
    y: cy - (w * Math.sin(rotation) + h * Math.cos(rotation)) / 2,
    props: { ...style, geo: obj.object === "circle" ? "ellipse" : "rectangle", w, h, growY: 0,
      richText: toRichText(obj.object === "textbox" ? obj.text : obj.label ?? ""),
      labelColor: color(obj.object === "textbox" ? obj.textColor : obj.labelColor ?? obj.strokeColor),
      font: "sans", ...(obj.object === "textbox" ? { size: size(obj.fontSize, fonts) } : {}) } };
}

export function shapeToObject(editor: Editor, shape: TLShape): BoardObjectSchemaType | null {
  const transform = editor.getShapePageTransform(shape);
  const rotation = -transform.rotation() * 180 / Math.PI;
  const base = { x: 0, y: 0, rotation, strokeColor: "#1d1d1d", fillColor: "transparent", strokeWidth: 2 };
  if (shape.type === "arrow") {
    if (shape.props.bend !== 0 || shape.props.kind !== "arc") return null;
    const { start, end } = getArrowTerminalsInArrowSpace(editor, shape, getArrowBindings(editor, shape));
    const center = transform.applyToPoint({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
    return { ...base, object: "arrow", x: center.x - (end.x - start.x) / 2, y: -center.y + (end.y - start.y) / 2,
      x2: center.x + (end.x - start.x) / 2, y2: -center.y - (end.y - start.y) / 2,
      strokeColor: colors[shape.props.color], strokeWidth: widths[shape.props.size] * shape.props.scale,
      label: renderPlaintextFromRichText(editor, shape.props.richText), labelColor: colors[shape.props.labelColor] };
  }
  if (shape.type === "text") {
    const bounds = editor.getShapeGeometry(shape).bounds;
    const center = transform.applyToPoint(bounds.center);
    const text = renderPlaintextFromRichText(editor, shape.props.richText);
    if (!text.trim()) return null;
    return { ...base, object: "textbox", x: center.x - bounds.w / 2, y: -center.y - bounds.h / 2,
      w: bounds.w, h: bounds.h, text, textColor: colors[shape.props.color], fontSize: fonts[shape.props.size] * shape.props.scale };
  }
  if (shape.type !== "geo" || !["rectangle", "ellipse"].includes(shape.props.geo)) return null;
  const { w, h: rawH, growY, scale } = shape.props;
  const h = rawH + growY;
  if (shape.props.geo === "ellipse" && Math.abs(w - h) > 0.01) return null;
  const center = transform.applyToPoint({ x: w / 2, y: h / 2 });
  const text = renderPlaintextFromRichText(editor, shape.props.richText);
  const shared = { ...base, strokeColor: colors[shape.props.color], strokeWidth: widths[shape.props.size] * scale,
    fillColor: shape.props.fill === "none" ? "transparent" : colors[shape.props.color], fillOpacity: shape.props.fill === "none" ? 0 : 1,
    label: text, labelColor: colors[shape.props.labelColor] };
  if (shape.props.geo === "ellipse") return { ...shared, object: "circle", x: center.x, y: -center.y, r: w / 2 };
  const box = { ...shared, x: center.x - w / 2, y: -center.y - h / 2, w, h };
  if (shape.meta.boardKind === "textbox") {
    if (!text.trim()) return null;
    return { ...box, object: "textbox", text, textColor: colors[shape.props.labelColor], fontSize: fonts[shape.props.size] * scale };
  }
  return { ...box, object: "rect" };
}

export function changedFields(before: BoardObjectSchemaType, after: BoardObjectSchemaType) {
  const old = before as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => key !== "object" && JSON.stringify(value) !== JSON.stringify(old[key])));
}
