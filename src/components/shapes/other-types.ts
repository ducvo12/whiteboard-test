import { ShapeBaseSchemaType } from "@/lib/whiteboard/schemas";

export type ToScreen = (x: number, y: number) => { sx: number; sy: number };

export function shapePaint(obj: ShapeBaseSchemaType, zoom = 1) {
  return {
    fill: obj.fillColor,
    fillOpacity: obj.fillOpacity ?? 1,
    stroke: obj.strokeColor,
    strokeWidth: obj.strokeWidth,
  };
}
