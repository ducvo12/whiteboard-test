import { StoredObjectSchemaValue } from "./schemas";

export const GRID = 50;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.15;
export const AXIS_EXTENT = 50_000;

export type Camera = {
  panX: number;
  panY: number;
  zoom: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera,
  viewH: number,
) {
  return {
    x: (sx - camera.panX) / camera.zoom,
    y: (viewH - sy + camera.panY) / camera.zoom,
  };
}

export function formatWorld(x: number, y: number) {
  return `(${Math.round(x)}, ${Math.round(y)})`;
}

export function zoomAtScreenPoint(
  sx: number,
  sy: number,
  nextZoom: number,
  camera: Camera,
  viewH: number,
): Camera {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(sx, sy, camera, viewH);
  return {
    zoom,
    panX: sx - world.x * zoom,
    panY: sy - (viewH - world.y * zoom),
  };
}

export function objectBounds(obj: StoredObjectSchemaValue): Bounds {
  if (obj.shape === "circle") {
    return {
      minX: obj.x - obj.r,
      minY: obj.y - obj.r,
      maxX: obj.x + obj.r,
      maxY: obj.y + obj.r,
    };
  }
  if (obj.shape === "rect" || obj.shape === "textbox") {
    return {
      minX: obj.x,
      minY: obj.y,
      maxX: obj.x + obj.w,
      maxY: obj.y + obj.h,
    };
  }
  const xs = obj.points.map((point) => point.x);
  const ys = obj.points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function unionBounds(objects: StoredObjectSchemaValue[]): Bounds | null {
  if (objects.length === 0) return null;
  return objects.reduce<Bounds>((bounds, obj) => {
    const next = objectBounds(obj);
    return {
      minX: Math.min(bounds.minX, next.minX),
      minY: Math.min(bounds.minY, next.minY),
      maxX: Math.max(bounds.maxX, next.maxX),
      maxY: Math.max(bounds.maxY, next.maxY),
    };
  }, objectBounds(objects[0]));
}

export function cameraToFit(
  bounds: Bounds,
  viewW: number,
  viewH: number,
  insetRight: number,
  insetBottom: number,
  padding = 64,
): Camera {
  const visibleW = Math.max(viewW - insetRight, 120);
  const visibleH = Math.max(viewH - insetBottom, 120);
  const worldW = Math.max(bounds.maxX - bounds.minX, 1);
  const worldH = Math.max(bounds.maxY - bounds.minY, 1);
  const zoom = clampZoom(
    Math.min(
      (visibleW - padding * 2) / worldW,
      (visibleH - padding * 2) / worldH,
    ),
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    panX: visibleW / 2 - centerX * zoom,
    panY: visibleH / 2 - viewH + centerY * zoom,
  };
}
