"use client";

import { useMemo } from "react";
import { PolygonGeoStyleUtil, polygonNativeShape } from "@/lib/whiteboard/polygon-native-style";

import { DefaultColorStyle, DefaultSizeStyle, DefaultFillStyle, DefaultDashStyle, Ellipse2d, HTMLContainer, Polygon2d, Polyline2d, Rectangle2d, ShapeUtil, SVGContainer, T, Vec, getIndexAbove, resizeBox, useEditor, useValue, type TLHandle, type TLHandleDragInfo, type TLResizeInfo, type SvgExportContext } from "tldraw";
import { polygonObject } from "@/lib/whiteboard/tldraw-adapter";
import BoardShape from "./board-shape";
import { boardBounds, boardProps, localBoardObject, type ExactBoardShape } from "@/lib/whiteboard/tldraw-board-model";
import { labelPlacement } from "@/lib/whiteboard/label";

function PolygonLabels({ shape }: { shape: ExactBoardShape }) {
  const object = polygonObject(shape.props);
  return <BoardShape obj={{ ...object, strokeColor: 'transparent', fillColor: 'transparent', id: shape.id }} toScreen={(x, y) => ({ sx: x, sy: -y })} zoom={1} />;
}

function Drawing({ shape }: { shape: ExactBoardShape }) {
  const editor = useEditor();
  const util = useMemo(() => new PolygonGeoStyleUtil(editor), [editor]);
  const native = polygonNativeShape(shape, editor);
  return <>
    {util.component(native)}
    <SVGContainer style={{ width: shape.props.w, height: shape.props.h, overflow: 'visible', fontFamily: 'Helvetica, Arial, sans-serif' }}><PolygonLabels shape={shape} /></SVGContainer>
  </>;
}

function Content({ shape }: { shape: ExactBoardShape }) {
  const editor = useEditor();
  const editing = useValue("editing board text", () => editor.getEditingShapeId() === shape.id, [editor, shape.id]);
  const object = polygonObject(shape.props);
  return <>
    <Drawing shape={shape} />
    {editing && <HTMLContainer style={{ pointerEvents: "all", width: Math.max(shape.props.w, 140), height: Math.max(shape.props.h, 60) }}>
      <textarea aria-label={object.object === "textbox" ? "Edit textbox" : "Edit shape label"} autoFocus
        defaultValue={object.object === "textbox" ? object.text : object.label ?? ""}
        style={{ width: "100%", height: "100%", minHeight: 0, fontSize: object.object === "textbox" ? object.fontSize : object.labelFontSize ?? 14 }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") editor.setEditingShape(null); }}
        onBlur={() => editor.setEditingShape(null)}
        onChange={(event) => editor.updateShape({ id: shape.id, type: shape.type, props: { data: JSON.stringify({ ...object,
          ...(object.object === "textbox" ? { text: event.target.value || " " } : { label: event.target.value }) }) } })} />
    </HTMLContainer>}
  </>;
}

export class ExactBoardShapeUtil extends ShapeUtil<ExactBoardShape> {
  static override type = "board-object" as const;
  static override props = { w: T.number, h: T.number, data: T.string, color: DefaultColorStyle, size: DefaultSizeStyle, fill: DefaultFillStyle, dash: DefaultDashStyle };
  getDefaultProps() { return boardProps({ object: "rect", x: 0, y: 0, w: 120, h: 80, rotation: 0, strokeColor: "#344b2d", fillColor: "#c5d4b4", strokeWidth: 2 }); }
  override canEdit() { return true; }
  override isAspectRatioLocked(shape: ExactBoardShape) { return localBoardObject(shape.props).object === "circle"; }
  getGeometry(shape: ExactBoardShape) {
    const object = polygonObject(shape.props);
    if (object.object === "circle") return new Ellipse2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
    if (object.object === "polygon") return new Polygon2d({ points: object.points.map((p) => new Vec(p.x, -p.y)), isFilled: true });
    if (object.object === "arrow") return new Polyline2d({ points: [new Vec(object.x, -object.y), new Vec(object.x2, -object.y2)] });
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }
  component(shape: ExactBoardShape) { return <Content shape={shape} />; }
  getIndicatorPath(shape: ExactBoardShape) { return new Path2D(this.getGeometry(shape).getSvgPathData()); }
  override getCanvasSvgDefs() { return new PolygonGeoStyleUtil(this.editor).getCanvasSvgDefs(); }
  override toSvg(shape: ExactBoardShape, context: SvgExportContext) {
    const util = new PolygonGeoStyleUtil(this.editor);
    return <g fontFamily="Helvetica, Arial, sans-serif">{util.toSvg(polygonNativeShape(shape, this.editor), context)}<PolygonLabels shape={shape} /></g>;
  }
  override onResize(shape: ExactBoardShape, info: TLResizeInfo<ExactBoardShape>) { return resizeBox(shape, info); }
  override getHandles(shape: ExactBoardShape): TLHandle[] {
    const object = polygonObject(shape.props);
    let index = getIndexAbove();
    const handle = (id: string, label: string, x: number, y: number): TLHandle => {
      const result = { id, label, x, y, type: "vertex" as const, index };
      index = getIndexAbove(index); return result;
    };
    const handles: TLHandle[] = [];
    if (object.object === "polygon") object.points.forEach((p, i) => handles.push(handle(`vertex-${i}`, `Vertex ${i + 1}`, p.x, -p.y)));
    if (object.object === "arrow") handles.push(handle("tail", "Arrow tail", object.x, -object.y), handle("head", "Arrow head", object.x2, -object.y2));
    if (object.label?.trim()) {
      const label = labelPlacement({ ...object, id: shape.id }, object.label);
      handles.push(handle("label", "Move label", label.cx, -label.cy));
    }
    return handles;
  }
  override onHandleDrag(current: ExactBoardShape, { handle, initial }: TLHandleDragInfo<ExactBoardShape>) {
    const shape = initial ?? current;
    const object = polygonObject(shape.props);
    if (handle.id === "label") {
      const b = boardBounds(object);
      return { id: shape.id, type: shape.type, props: { data: JSON.stringify({ ...object,
        labelX: (handle.x - b.minX) / Math.max(b.maxX - b.minX, 1),
        labelY: (-handle.y - b.minY) / Math.max(b.maxY - b.minY, 1) }) } };
    }
    if (object.object === "polygon" && handle.id.startsWith("vertex-")) {
      const i = Number(handle.id.slice(7));
      object.points[i] = { x: handle.x, y: -handle.y };
      object.x = object.points[0].x; object.y = object.points[0].y;
    } else if (object.object === "arrow") {
      if (handle.id === "tail") { object.x = handle.x; object.y = -handle.y; }
      else { object.x2 = handle.x; object.y2 = -handle.y; }
    } else return;
    const bounds = boardBounds(object);
    const dx = bounds.minX, dy = -bounds.maxY;
    return { id: shape.id, type: shape.type, x: shape.x + dx * Math.cos(shape.rotation) - dy * Math.sin(shape.rotation),
      y: shape.y + dx * Math.sin(shape.rotation) + dy * Math.cos(shape.rotation), props: { ...boardProps(object), color: shape.props.color, size: shape.props.size, fill: shape.props.fill, dash: shape.props.dash } };
  }
}
