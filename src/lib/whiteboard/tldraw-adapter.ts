import { readAttachedLabel, labelFields, labelFromObject, needsAttachedLabel } from "./attached-label.ts";
import { toRichText, createShapeId, getArrowBindings, getArrowTerminalsInArrowSpace, renderPlaintextFromRichText, type Editor, type TLDefaultColorStyle, type TLShape, type TLShapePartial } from "tldraw";
import { boardPosition, boardProps, exactShapeObject, localBoardObject } from "./tldraw-board-model.ts";
import type { BoardObjectSchemaType, StoredObjectSchemaType } from "./schemas";

export const colors: Record<TLDefaultColorStyle, string> = {
  white: "#ffffff",
  black: "#1d1d1d", grey: "#9fa8b2", "light-violet": "#e085f4", violet: "#ae3ec9",
  blue: "#4465e9", "light-blue": "#4ba1f1", yellow: "#f1ac4b", orange: "#e16919",
  green: "#099268", "light-green": "#4cb05e", "light-red": "#f87777", red: "#e03131",
};
export const widths = { s: 2, m: 3.5, l: 5, xl: 10 };
export const fonts = { s: 18, m: 24, l: 36, xl: 44 };

export function shapeId(id: string) { return id.startsWith("shape:") ? id as TLShape["id"] : createShapeId(id); }
export function nearestColor(value: string): TLDefaultColorStyle {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (!hex) return 'black';
  const rgb = (v: string) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  const target = rgb(value);
  return Object.keys(colors).reduce((best, key) => {
    const distance = (k: string) => rgb(colors[k as TLDefaultColorStyle]).reduce((sum, c, i) => sum + (c - target[i]) ** 2, 0);
    return distance(key) < distance(best) ? key : best;
  }, 'black') as TLDefaultColorStyle;
}
export function nearestSize(value: number, sizes = widths): keyof typeof widths {
  return (Object.keys(sizes) as (keyof typeof widths)[]).reduce((a, b) => Math.abs(sizes[a] - value) < Math.abs(sizes[b] - value) ? a : b);
}
export function objectToShape(obj: StoredObjectSchemaType): TLShapePartial {
  const position = boardPosition(obj), bounds = boardProps(obj);
  const attached = needsAttachedLabel(obj) ? labelFromObject(obj) : null;
  const meta = { boardId: obj.id, boardKind: obj.object, attachedLabel: attached };
  const style = { color: nearestColor(obj.strokeColor), size: nearestSize(obj.strokeWidth),
    fill: obj.fillColor === 'transparent' || obj.fillOpacity === 0 ? 'none' as const : 'solid' as const,
    dash: 'solid' as const };
  if (obj.object === 'polygon') return { id: shapeId(obj.id), type: 'board-object', ...position, meta,
    props: { ...bounds, ...style } };
  if (obj.object === 'arrow') {
    const local = localBoardObject(bounds);
    if (local.object !== 'arrow') throw new Error('Expected arrow');
    return { id: shapeId(obj.id), type: 'arrow', ...position, meta, props: { ...style,
      start: { x: local.x, y: -local.y }, end: { x: local.x2, y: -local.y2 }, bend: 0,
      richText: toRichText(attached ? '' : obj.label ?? ''), labelColor: nearestColor(obj.labelColor ?? obj.strokeColor), font: 'sans' } };
  }
  return { id: shapeId(obj.id), type: 'geo', ...position, meta, props: { ...style,
    geo: obj.object === 'circle' ? 'ellipse' : 'rectangle', w: bounds.w, h: bounds.h, growY: 0,
    richText: toRichText(obj.object === 'textbox' ? obj.text : attached ? '' : obj.label ?? ''), font: 'sans',
    labelColor: nearestColor(obj.object === 'textbox' ? obj.textColor : obj.labelColor ?? obj.strokeColor),
    ...(obj.object === 'textbox' ? { size: nearestSize(obj.fontSize, fonts) } : {}) } };
}

export function shapeToObject(editor: Editor, shape: TLShape): BoardObjectSchemaType | null {
  const object = nativeShapeToObject(editor, shape);
  const label = readAttachedLabel(shape);
  return object && label ? { ...object, ...labelFields(label) } : object;
}
function nativeShapeToObject(editor: Editor, shape: TLShape): BoardObjectSchemaType | null {
  const transform = editor.getShapePageTransform(shape);
  if (shape.type === "board-object") {
    return exactShapeObject({ ...shape.props, data: JSON.stringify(polygonObject(shape.props)) }, transform.applyToPoint({ x: shape.props.w / 2, y: shape.props.h / 2 }), transform.rotation());
  }
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
    return { ...box, label: "", object: "textbox", text, textColor: colors[shape.props.labelColor], fontSize: fonts[shape.props.size] * scale };
  }
  return { ...box, object: "rect" };
}

export function changedFields(before: BoardObjectSchemaType, after: BoardObjectSchemaType) {
  const old = before as unknown as Record<string, unknown>;
  const next = after as unknown as Record<string, unknown>;
  return Object.fromEntries([...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter(key => key !== "object" && JSON.stringify(next[key]) !== JSON.stringify(old[key]))
    .map(key => [key, next[key]]));
}

export function polygonObject(props: import('./tldraw-board-model').ExactBoardProps): BoardObjectSchemaType {
  const object = localBoardObject(props);
  return { ...object, strokeColor: colors[props.color], strokeWidth: widths[props.size],
    fillColor: props.fill === 'none' ? 'transparent' : colors[props.color],
    fillOpacity: props.fill === 'semi' ? 0.25 : props.fill === 'none' ? 0 : 1 };
}

/** Legacy server updates only replace native styles they explicitly changed. */
export function preserveNativeStyles(previous: BoardObjectSchemaType, next: BoardObjectSchemaType, incoming: Record<string, unknown>) {
  const changed = changedFields(previous, next);
  const props = { ...incoming };
  delete props.dash;
  delete props.font;
  if (!('strokeColor' in changed)) delete props.color;
  if (!('strokeWidth' in changed) && !('fontSize' in changed)) delete props.size;
  if (!('fillColor' in changed) && !('fillOpacity' in changed)) delete props.fill;
  if (!('labelColor' in changed) && !('textColor' in changed)) delete props.labelColor;
  if (!('label' in changed) && !('text' in changed)) delete props.richText;
  return props;
}

/** Duplicates inherit metadata, but must receive their own server identity. */
export function serverObjectId(shape: Pick<TLShape, 'id' | 'meta'>) {
  return typeof shape.meta.boardId === 'string' && shapeId(shape.meta.boardId) === shape.id ? shape.meta.boardId : shape.id;
}
