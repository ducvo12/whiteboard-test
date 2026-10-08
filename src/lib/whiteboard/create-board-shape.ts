import { createShapeId, type Editor } from "tldraw";
import type { BoardObjectSchemaType } from "./schemas";
import { objectToShape } from "./tldraw-adapter";

export function createBoardShape(editor: Editor, kind: BoardObjectSchemaType["object"]) {
  if (editor.getIsReadonly()) return;
  editor.complete();
  editor.setCurrentTool("select");
  const center = editor.getViewportPageBounds().center;
  const base = { x: center.x - 70, y: -center.y - 45, rotation: 0, strokeColor: "#344b2d", fillColor: "#c5d4b4", strokeWidth: 2 };
  let object: BoardObjectSchemaType;
  if (kind === "circle") object = { ...base, object: kind, x: center.x, y: -center.y, r: 50 };
  else if (kind === "polygon") object = { ...base, object: kind, points: [{ x: base.x, y: base.y }, { x: base.x + 140, y: base.y }, { x: base.x + 110, y: base.y + 90 }, { x: base.x + 30, y: base.y + 110 }] };
  else if (kind === "arrow") object = { ...base, object: kind, x2: base.x + 140, y2: base.y + 90 };
  else if (kind === "textbox") object = { ...base, object: kind, w: 180, h: 90, text: "Text", fontSize: 18, textColor: "#1f241c" };
  else object = { ...base, object: "rect", w: 140, h: 90 };
  const id = createShapeId();
  editor.markHistoryStoppingPoint("Add board shape");
  const partial = objectToShape({ ...object, id });
  // The editor applies shared styles automatically when omitted from the partial.
  if (partial.props) {
    const props = { ...partial.props } as Record<string, unknown>;
    for (const key of ['color', 'size', 'fill', 'dash']) delete props[key];
    partial.props = props;
  }
  editor.createShape(partial);
  editor.setSelectedShapes([id]);
}
