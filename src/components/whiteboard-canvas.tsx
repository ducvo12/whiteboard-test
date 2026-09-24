"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BoardShape from "@/components/shapes/board-shape";
import CanvasHud from "@/components/canvas-hud";
import { BoardObjectSchemaType, StoredObjectSchemaType } from "@/lib/whiteboard/schemas";
import {
  AXIS_EXTENT,
  GRID,
  ZOOM_STEP,
  type Camera,
  cameraToFit,
  formatWorld,
  objectBounds,
  screenToWorld,
  unionBounds,
  zoomAtScreenPoint,
} from "@/lib/whiteboard/geometry";

const MOBILE_QUERY = "(max-width: 720px)";
const POLL_MS = 800;
const MIN_SIZE = 12;
const HANDLE_PX = 12;

const PAINT = {
  strokeColor: "#344b2d",
  fillColor: "#c5d4b4",
  strokeWidth: 2,
};

type Gesture =
  | {
      kind: "pan";
      pointerId: number;
      startX: number;
      startY: number;
      panX: number;
      panY: number;
    }
  | {
      kind: "move" | "scale";
      pointerId: number;
      id: string;
      startWorldX: number;
      startWorldY: number;
      orig: StoredObjectSchemaType;
    };

function panelInsets(chatOpen: boolean, viewH: number) {
  if (!chatOpen) return { right: 0, bottom: 0 };
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return { right: 0, bottom: 12 + Math.min(viewH * 0.62, 560) };
  }
  return { right: 352, bottom: 0 };
}

function hitObject(worldX: number, worldY: number, objects: StoredObjectSchemaType[]) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const bounds = objectBounds(objects[i]);
    if (
      worldX >= bounds.minX &&
      worldX <= bounds.maxX &&
      worldY >= bounds.minY &&
      worldY <= bounds.maxY
    ) {
      return objects[i];
    }
  }
  return null;
}

function movedObject(orig: StoredObjectSchemaType, dx: number, dy: number): StoredObjectSchemaType {
  if (orig.object === "polygon") {
    return {
      ...orig,
      x: orig.x + dx,
      y: orig.y + dy,
      points: orig.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }
  return { ...orig, x: orig.x + dx, y: orig.y + dy };
}

function scaledObject(orig: StoredObjectSchemaType, worldX: number, worldY: number): StoredObjectSchemaType {
  if (orig.object === "circle") {
    const r = Math.max(MIN_SIZE, Math.hypot(worldX - orig.x, worldY - orig.y));
    return { ...orig, r };
  }

  if (orig.object === "polygon") {
    const bounds = objectBounds(orig);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const start = Math.hypot(bounds.maxX - cx, bounds.minY - cy) || 1;
    const scale = Math.max(MIN_SIZE / start, Math.hypot(worldX - cx, worldY - cy) / start);
    const points = orig.points.map((point) => ({
      x: cx + (point.x - cx) * scale,
      y: cy + (point.y - cy) * scale,
    }));
    return { ...orig, x: points[0].x, y: points[0].y, points };
  }

  const top = orig.y + orig.h;
  const w = Math.max(MIN_SIZE, worldX - orig.x);
  const y = Math.min(worldY, top - MIN_SIZE);
  return { ...orig, y, w, h: top - y };
}

function geometryPatch(obj: StoredObjectSchemaType) {
  if (obj.object === "circle") return { x: obj.x, y: obj.y, r: obj.r };
  if (obj.object === "polygon") return { x: obj.x, y: obj.y, points: obj.points };
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
}

export default function WhiteboardCanvas({
  agentWorking,
  chatOpen,
}: {
  agentWorking: boolean;
  chatOpen: boolean;
}) {
  const boardRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const gestureRef = useRef<Gesture | null>(null);
  const objectsRef = useRef<StoredObjectSchemaType[]>([]);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const [objects, setObjects] = useState<StoredObjectSchemaType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editingIdRef = useRef<string | null>(null);
  const draftRef = useRef("");

  const { width, height } = size;
  const { panX, panY, zoom } = camera;
  const selected = objects.find((obj) => obj.id === selectedId) ?? null;
  const editing = objects.find((obj) => obj.id === editingId && obj.object === "textbox") ?? null;

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/objects");
        const result = await response.json();
        if (!cancelled && Array.isArray(result) && !gestureRef.current) {
          setObjects(result);
        }
      } catch {
        // Keep the last board if a poll fails.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    if (!agentWorking) {
      return () => {
        cancelled = true;
      };
    }

    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [agentWorking]);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const node = boardRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const next = zoomAtScreenPoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        cameraRef.current.zoom *
        (event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP),
        cameraRef.current,
        node.clientHeight,
      );
      cameraRef.current = next;
      setCamera(next);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomAround(sx: number, sy: number, nextZoom: number) {
    const viewH = boardRef.current?.clientHeight ?? height;
    setCamera(zoomAtScreenPoint(sx, sy, nextZoom, camera, viewH));
  }

  function visibleCenter() {
    const viewW = boardRef.current?.clientWidth ?? width;
    const viewH = boardRef.current?.clientHeight ?? height;
    const inset = panelInsets(chatOpen, viewH);
    return {
      sx: (viewW - inset.right) / 2,
      sy: (viewH - inset.bottom) / 2,
    };
  }

  function pointerWorld(e: { clientX: number; clientY: number }) {
    const node = boardRef.current;
    const rect = node?.getBoundingClientRect();
    const viewH = node?.clientHeight ?? height;
    return screenToWorld(
      e.clientX - (rect?.left ?? 0),
      e.clientY - (rect?.top ?? 0),
      cameraRef.current,
      viewH,
    );
  }

  function worldToBoard(x: number, y: number) {
    const viewH = boardRef.current?.clientHeight ?? height;
    const cam = cameraRef.current;
    return {
      sx: x * cam.zoom + cam.panX,
      sy: viewH - y * cam.zoom + cam.panY,
    };
  }

  function replaceObject(next: StoredObjectSchemaType) {
    const list = objectsRef.current.map((obj) => (obj.id === next.id ? next : obj));
    objectsRef.current = list;
    setObjects(list);
  }

  async function savePatch(id: string, patch: Record<string, unknown>) {
    await fetch("/api/objects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch }),
    });
  }

  async function addObject(body: BoardObjectSchemaType) {
    const response = await fetch("/api/objects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = await response.json();
    if (!response.ok || !created?.id) return;
    const list = [...objectsRef.current, created as StoredObjectSchemaType];
    objectsRef.current = list;
    setObjects(list);
    setSelectedId(created.id);
    setEditingId(null);
  }

  function addAtCenter(kind: BoardObjectSchemaType["object"]) {
    const node = boardRef.current;
    const viewH = node?.clientHeight ?? height;
    const { sx, sy } = visibleCenter();
    const center = screenToWorld(sx, sy, cameraRef.current, viewH);

    if (kind === "circle") {
      void addObject({ object: "circle", x: center.x, y: center.y, r: 40, ...PAINT });
      return;
    }
    if (kind === "rect") {
      void addObject({
        object: "rect",
        x: center.x - 60,
        y: center.y - 40,
        w: 120,
        h: 80,
        ...PAINT,
      });
      return;
    }
    if (kind === "textbox") {
      void addObject({
        object: "textbox",
        x: center.x - 90,
        y: center.y - 36,
        w: 180,
        h: 72,
        text: "Text",
        fontSize: 18,
        textColor: "#1f241c",
        ...PAINT,
      });
      return;
    }

    const points = [
      { x: center.x, y: center.y + 50 },
      { x: center.x + 60, y: center.y },
      { x: center.x, y: center.y - 50 },
      { x: center.x - 60, y: center.y },
    ];
    void addObject({
      object: "polygon",
      x: points[0].x,
      y: points[0].y,
      points,
      ...PAINT,
      fillOpacity: 0.85,
    });
  }

  function commitText() {
    const id = editingIdRef.current;
    if (!id) return;
    editingIdRef.current = null;
    setEditingId(null);
    const obj = objectsRef.current.find((item) => item.id === id);
    const text = draftRef.current;
    if (!obj || obj.object !== "textbox" || !text || text === obj.text) return;
    replaceObject({ ...obj, text });
    void savePatch(id, { text });
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("textarea")) return;
    commitText();
    if (e.target instanceof Element && e.target.closest("button, .canvas-hud, .add-bar")) {
      return;
    }
    e.preventDefault();
    const world = pointerWorld(e);

    if (selected) {
      const bounds = objectBounds(selected);
      const handle = worldToBoard(bounds.maxX, bounds.minY);
      const rect = boardRef.current?.getBoundingClientRect();
      const sx = e.clientX - (rect?.left ?? 0);
      const sy = e.clientY - (rect?.top ?? 0);
      if (Math.hypot(sx - handle.sx, sy - handle.sy) <= HANDLE_PX) {
        e.currentTarget.setPointerCapture(e.pointerId);
        gestureRef.current = {
          kind: "scale",
          pointerId: e.pointerId,
          id: selected.id,
          startWorldX: world.x,
          startWorldY: world.y,
          orig: selected,
        };
        setEditingId(null);
        return;
      }
    }

    const hit = hitObject(world.x, world.y, objectsRef.current);
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current = {
        kind: "move",
        pointerId: e.pointerId,
        id: hit.id,
        startWorldX: world.x,
        startWorldY: world.y,
        orig: hit,
      };
      setSelectedId(hit.id);
      if (editingId !== hit.id) setEditingId(null);
      return;
    }

    setSelectedId(null);
    setEditingId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current = {
      kind: "pan",
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: camera.panX,
      panY: camera.panY,
    };
    e.currentTarget.classList.add("is-panning");
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== e.pointerId) return;

    if (gesture.kind === "pan") {
      setCamera((current) => ({
        ...current,
        panX: gesture.panX + (e.clientX - gesture.startX),
        panY: gesture.panY + (e.clientY - gesture.startY),
      }));
      return;
    }

    const world = pointerWorld(e);
    const next = gesture.kind === "move"
      ? movedObject(gesture.orig, world.x - gesture.startWorldX, world.y - gesture.startWorldY)
      : scaledObject(gesture.orig, world.x, world.y);
    replaceObject(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== e.pointerId) return;
    gestureRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.currentTarget.classList.remove("is-panning");

    if (gesture.kind === "pan") return;
    const obj = objectsRef.current.find((item) => item.id === gesture.id);
    if (!obj) return;
    void savePatch(gesture.id, geometryPatch(obj));
  }

  function onDoubleClick(e: React.MouseEvent<HTMLElement>) {
    if (e.target instanceof Element && e.target.closest("button, textarea, .canvas-hud, .add-bar")) {
      return;
    }
    const world = pointerWorld(e);
    const hit = hitObject(world.x, world.y, objectsRef.current);
    if (hit?.object === "textbox") {
      setSelectedId(hit.id);
      editingIdRef.current = hit.id;
      setEditingId(hit.id);
      draftRef.current = hit.text;
      setDraft(hit.text);
    }
  }

  function toScreen(x: number, y: number) {
    return { sx: x * zoom, sy: height - y * zoom };
  }

  function onFit() {
    const viewW = boardRef.current?.clientWidth ?? width;
    const viewH = boardRef.current?.clientHeight ?? height;
    const bounds = unionBounds(objects);
    if (!bounds) {
      setCamera({ panX: 0, panY: 0, zoom: 1 });
      return;
    }
    const inset = panelInsets(chatOpen, viewH);
    setCamera(cameraToFit(bounds, viewW, viewH, inset.right, inset.bottom));
  }

  const origin = screenToWorld(0, height, camera, height);
  const extent = screenToWorld(width, 0, camera, height);
  const gridPx = GRID * zoom;
  const selection = selected ? objectBounds(selected) : null;
  const selectionScreen = selection ? toScreen(selection.minX, selection.maxY) : null;
  const handleScreen = selection ? toScreen(selection.maxX, selection.minY) : null;
  const editorBox = editing?.object === "textbox" ? worldToBoard(editing.x, editing.y + editing.h) : null;

  return (
    <section
      ref={boardRef}
      className="canvas"
      aria-label="Whiteboard canvas"
      style={{
        backgroundImage: `radial-gradient(circle at 0 0, rgba(31, 36, 28, 0.14) 1px, transparent 1.6px)`,
        backgroundSize: `${gridPx}px ${gridPx}px`,
        backgroundPosition: `${panX}px ${height + panY}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {agentWorking && <div className="canvas-pulse" aria-hidden="true" />}

      <svg width={width} height={height}>
        <g transform={`translate(${panX} ${panY})`}>
          <line
            className="axis-line"
            x1={-AXIS_EXTENT * zoom}
            y1={height}
            x2={AXIS_EXTENT * zoom}
            y2={height}
          />
          <line
            className="axis-line"
            x1={0}
            y1={height - AXIS_EXTENT * zoom}
            x2={0}
            y2={height + AXIS_EXTENT * zoom}
          />
          {objects.map((obj) => (
            <BoardShape key={obj.id} obj={obj} toScreen={toScreen} zoom={zoom} />
          ))}
          {selection && selectionScreen && handleScreen && (
            <g className="selection" pointerEvents="none">
              <rect
                x={selectionScreen.sx}
                y={selectionScreen.sy}
                width={(selection.maxX - selection.minX) * zoom}
                height={(selection.maxY - selection.minY) * zoom}
              />
              <rect
                className="scale-handle"
                x={handleScreen.sx - 5}
                y={handleScreen.sy - 5}
                width={10}
                height={10}
              />
            </g>
          )}
        </g>
      </svg>

      {editorBox && editing?.object === "textbox" && (
        <textarea
          className="textbox-editor"
          style={{
            left: editorBox.sx,
            top: editorBox.sy,
            width: editing.w * zoom,
            height: editing.h * zoom,
            fontSize: editing.fontSize * zoom,
            color: editing.textColor,
            background: editing.fillColor,
          }}
          value={draft}
          autoFocus
          onChange={(event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
          }}
          onBlur={commitText}
        />
      )}

      {loaded && objects.length === 0 && (
        <p className="canvas-empty">Add a shape, or ask AI to put something here.</p>
      )}

      {agentWorking && objects.length > 0 && (
        <div className="working-chip">Working on the board…</div>
      )}

      <div className="coord-origin">{formatWorld(origin.x, origin.y)}</div>
      <div className="coord-extent">{formatWorld(extent.x, extent.y)}</div>

      <div className="add-bar" role="toolbar" aria-label="Add objects">
        <button type="button" onClick={() => addAtCenter("circle")}>Circle</button>
        <button type="button" onClick={() => addAtCenter("rect")}>Rectangle</button>
        <button type="button" onClick={() => addAtCenter("polygon")}>Polygon</button>
        <button type="button" onClick={() => addAtCenter("textbox")}>Textbox</button>
      </div>

      <CanvasHud
        zoom={zoom}
        onZoomIn={() => {
          const { sx, sy } = visibleCenter();
          zoomAround(sx, sy, camera.zoom * ZOOM_STEP);
        }}
        onZoomOut={() => {
          const { sx, sy } = visibleCenter();
          zoomAround(sx, sy, camera.zoom / ZOOM_STEP);
        }}
        onResetZoom={() => {
          const { sx, sy } = visibleCenter();
          zoomAround(sx, sy, 1);
        }}
        onFit={onFit}
        onOrigin={() => setCamera({ panX: 0, panY: 0, zoom: 1 })}
      />
    </section>
  );
}
