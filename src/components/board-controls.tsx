"use client";

import { BoardFileControls } from "./board-file-controls";
import { AttachedLabels, LabelOptions } from "./attached-labels";
import { useState } from "react";
import { DefaultStylePanel, createShapeId, useEditor, useValue, type TLUiStylePanelProps } from "tldraw";
import { BoardObjectSchema, type BoardObjectSchemaType } from "@/lib/whiteboard/schemas";
import { objectToShape, shapeToObject } from "@/lib/whiteboard/tldraw-adapter";

export function BoardStylePanel(props: TLUiStylePanelProps) {
  return <DefaultStylePanel {...props} />;
}

export function BoardControls() {
  const editor = useEditor();
  const [axes, setAxes] = useState(true);
  const state = useValue("board controls", () => {
    const shape = editor.getOnlySelectedShape();
    return { shape, object: shape?.type === "board-object" ? shapeToObject(editor, shape) : null,
      view: editor.getViewportPageBounds(), zoom: editor.getCamera().z,
      pointer: editor.inputs.getCurrentPagePoint(), grid: editor.getInstanceState().isGridMode,
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
  function create(kind: BoardObjectSchemaType["object"]) {
    editor.complete();
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
    <div className="board-tools" onPointerDown={(event) => event.stopPropagation()}>
      <details><summary>Add shape</summary><div className="board-add-menu">
        {(["rect", "circle", "polygon", "arrow", "textbox"] as const).map((kind) => <button key={kind} disabled={state.readonly} onClick={(event) => { create(kind); const menu = event.currentTarget.closest("details"); if (menu) menu.open = false; }}>{kind === "rect" ? "Rectangle" : kind[0].toUpperCase() + kind.slice(1)}</button>)}
      </div></details>
      <BoardFileControls />
      <button aria-pressed={state.grid} onClick={() => editor.updateInstanceState({ isGridMode: !state.grid })}>Grid</button>
      <button aria-pressed={axes} onClick={() => setAxes(!axes)}>Axes</button>
    </div>
    <output className="board-coordinates">({Math.round(state.pointer.x)}, {Math.round(-state.pointer.y)}) · Y ↑</output>
  </>;
}
