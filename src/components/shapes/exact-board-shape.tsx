"use client";

import { polygonRecordProps } from "@/lib/whiteboard/document-schema";
import { useMemo } from "react";
import { PolygonGeoStyleUtil, polygonNativeShape } from "@/lib/whiteboard/polygon-native-style";

import { Ellipse2d, Polygon2d, Polyline2d, Rectangle2d, ShapeUtil, Vec, getIndexAbove, resizeBox, useEditor, type TLHandle, type TLHandleDragInfo, type TLResizeInfo, type SvgExportContext } from "tldraw";
import { polygonObject } from "@/lib/whiteboard/tldraw-adapter";
import { boardBounds, boardProps, localBoardObject, type ExactBoardShape } from "@/lib/whiteboard/tldraw-board-model";
import { labelMetrics } from "@/lib/whiteboard/label";
import { labelPoint } from "@/lib/whiteboard/attached-label";
import { readShapeLabel } from "@/lib/whiteboard/polygon-label";

function PolygonLabels({ shape }: { shape: ExactBoardShape }) {
  const label = readShapeLabel(shape);
  if (!label?.text.trim()) return null;
  const center = labelPoint({x:0,y:0,w:shape.props.w,h:shape.props.h}, label);
  const lines = label.text.split('\n');
  const width = Math.max(...lines.map(line => labelMetrics(line, label.size).w)) + 12;
  const lineHeight = label.size * 1.2, height = lines.length * lineHeight + 6;
  return <g>
    <rect x={center.x-width/2} y={center.y-height/2} width={width} height={height} rx={3} fill={label.background} stroke="#e3e5dc" />
    <text fill={label.color} fontSize={label.size} textAnchor="middle" dominantBaseline="central">
      {lines.map((line,i) => <tspan key={i} x={center.x} y={center.y+(i-(lines.length-1)/2)*lineHeight}>{line}</tspan>)}
    </text>
  </g>;
}

function Drawing({ shape }: { shape: ExactBoardShape }) {
  const editor = useEditor();
  const util = useMemo(() => new PolygonGeoStyleUtil(editor), [editor]);
  return util.component(polygonNativeShape(shape, editor));
}

export class ExactBoardShapeUtil extends ShapeUtil<ExactBoardShape> {
  static override type = "board-object" as const;
  static override props = polygonRecordProps;
  getDefaultProps() { return boardProps({ object: "rect", x: 0, y: 0, w: 120, h: 80, rotation: 0, strokeColor: "#344b2d", fillColor: "#c5d4b4", strokeWidth: 2 }); }
  override canEdit() { return false; }
  override isAspectRatioLocked(shape: ExactBoardShape) { return localBoardObject(shape.props).object === "circle"; }
  getGeometry(shape: ExactBoardShape) {
    const object = polygonObject(shape.props);
    if (object.object === "circle") return new Ellipse2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
    if (object.object === "polygon") return new Polygon2d({ points: object.points.map((p) => new Vec(p.x, -p.y)), isFilled: true });
    if (object.object === "arrow") return new Polyline2d({ points: [new Vec(object.x, -object.y), new Vec(object.x2, -object.y2)] });
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }
  component(shape: ExactBoardShape) { return <Drawing shape={shape} />; }
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
    return handles;
  }
  override onHandleDrag(current: ExactBoardShape, { handle, initial }: TLHandleDragInfo<ExactBoardShape>) {
    const shape = initial ?? current;
    const object = polygonObject(shape.props);
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
