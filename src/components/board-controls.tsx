"use client";

import { AttachedLabels, LabelOptions } from "./attached-labels";
import { useBoardPreferences } from "./board-preferences";
import { DefaultStylePanel, useEditor, useValue, type TLUiStylePanelProps } from "tldraw";
import { BoardObjectSchema } from "@/lib/whiteboard/schemas";
import { objectToShape, shapeToObject } from "@/lib/whiteboard/tldraw-adapter";

export function BoardStylePanel(props: TLUiStylePanelProps) {
  return <DefaultStylePanel {...props} />;
}

export function BoardControls() {
  const editor = useEditor();
  const { axes } = useBoardPreferences();
  const state = useValue("board controls", () => {
    const shape = editor.getOnlySelectedShape();
    return { shape, object: shape?.type === "board-object" ? shapeToObject(editor, shape) : null,
      view: editor.getViewportPageBounds(), zoom: editor.getCamera().z,
      pointer: editor.inputs.getCurrentPagePoint(),
      readonly: editor.getIsReadonly() };
  }, [editor]);
  const { object, shape, view, zoom } = state;

  function patch(values: Record<string, unknown>) {
    if (!object || !shape) return;
    const parsed = BoardObjectSchema.safeParse({ ...object, ...values });
    if (!parsed.success) return;
    editor.markHistoryStoppingPoint("Edit board properties");
    const update = objectToShape({ ...parsed.data, id: typeof shape.meta.boardId === "string" ? shape.meta.boardId : shape.id });
    if (shape.type === 'board-object') update.props = { ...update.props, color: shape.props.color, size: shape.props.size, fill: shape.props.fill, dash: shape.props.dash };
    editor.updateShape(update);
  }
  const originX = -view.x * zoom, originY = -view.y * zoom;
  return <>
    <AttachedLabels />
    {shape && <LabelOptions shape={shape}>
      {object?.object === "polygon" && <>
        <p>Drag the vertex handles to reshape the polygon.</p>
        <button disabled={state.readonly || editor.isShapeOrAncestorLocked(shape)} onClick={() => {
          const first = object.points[0], last = object.points.at(-1)!;
          patch({ points: [...object.points, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }] });
        }}>Add vertex</button>
        <button disabled={state.readonly || editor.isShapeOrAncestorLocked(shape) || object.points.length <= 3}
          onClick={() => patch({ points: object.points.slice(0, -1) })}>Remove last vertex</button>
      </>}
    </LabelOptions>}
    {axes && <svg className="board-axes" aria-hidden="true" width="100%" height="100%">
      <line x1={originX} x2={originX} y1="0" y2="100%" />
      <line x1="0" x2="100%" y1={originY} y2={originY} />
      <text x={originX + 5} y={originY - 5}>(0, 0)</text>
    </svg>}
    <output className="board-coordinates">({Math.round(state.pointer.x)}, {Math.round(-state.pointer.y)}) · Y ↑</output>
  </>;
}
