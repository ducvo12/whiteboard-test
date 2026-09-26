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
const END_HIT_PX = 8;
const CLICK_SLOP = 5;

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
    }
  | {
      kind: "aim";
      pointerId: number;
      id: string;
      end: "tail" | "head";
      orig: StoredObjectSchemaType;
    }
  | {
      kind: "vertex";
      pointerId: number;
      id: string;
      index: number;
      orig: StoredObjectSchemaType;
    }
  | {
      kind: "press";
      pointerId: number;
      startX: number;
      startY: number;
      worldX: number;
      worldY: number;
      panX: number;
      panY: number;
    };

type DrawTool = "circle" | "rect" | "polygon" | "arrow" | "textbox";

type DrawDraft =
  | { kind: "circle" | "rect" | "textbox"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "arrow"; x: number; y: number; x2: number; y2: number }
  | { kind: "polygon"; points: { x: number; y: number }[]; cursor: { x: number; y: number } | null };

function dragBox(x0: number, y0: number, x1: number, y1: number) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

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
  if (orig.object === "arrow") {
    return {
      ...orig,
      x: orig.x + dx,
      y: orig.y + dy,
      x2: orig.x2 + dx,
      y2: orig.y2 + dy,
    };
  }
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

  if (orig.object === "arrow") {
    const cx = (orig.x + orig.x2) / 2;
    const cy = (orig.y + orig.y2) / 2;
    const start = Math.hypot(orig.x2 - cx, orig.y2 - cy) || 1;
    const scale = Math.max(MIN_SIZE / start, Math.hypot(worldX - cx, worldY - cy) / start);
    return {
      ...orig,
      x: cx + (orig.x - cx) * scale,
      y: cy + (orig.y - cy) * scale,
      x2: cx + (orig.x2 - cx) * scale,
      y2: cy + (orig.y2 - cy) * scale,
    };
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

function withPointCount(points: { x: number; y: number }[], count: number) {
  const next = points.map((point) => ({ x: point.x, y: point.y }));
  const target = Math.max(3, Math.min(30, Math.round(count)));
  while (next.length < target) {
    let edge = 0;
    let longest = -1;
    for (let i = 0; i < next.length; i++) {
      const start = next[i];
      const end = next[(i + 1) % next.length];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length > longest) {
        longest = length;
        edge = i;
      }
    }
    const start = next[edge];
    const end = next[(edge + 1) % next.length];
    next.splice(edge + 1, 0, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
  }
  while (next.length > target) {
    let drop = 0;
    let flattest = Infinity;
    for (let i = 0; i < next.length; i++) {
      const prev = next[(i - 1 + next.length) % next.length];
      const point = next[i];
      const after = next[(i + 1) % next.length];
      const dx = after.x - prev.x;
      const dy = after.y - prev.y;
      const length = Math.hypot(dx, dy) || 1;
      const distance = Math.abs((point.x - prev.x) * dy - (point.y - prev.y) * dx) / length;
      if (distance < flattest) {
        flattest = distance;
        drop = i;
      }
    }
    next.splice(drop, 1);
  }
  return next;
}

function geometryPatch(obj: StoredObjectSchemaType) {
  if (obj.object === "circle") return { x: obj.x, y: obj.y, r: obj.r };
  if (obj.object === "polygon") return { x: obj.x, y: obj.y, points: obj.points };
  if (obj.object === "arrow") return { x: obj.x, y: obj.y, x2: obj.x2, y2: obj.y2 };
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
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({});
  const [drawTool, setDrawTool] = useState<DrawTool | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const draftRef = useRef("");
  const numberDraftsRef = useRef<Record<string, string>>({});
  const drawToolRef = useRef<DrawTool | null>(null);
  const drawDraftRef = useRef<DrawDraft | null>(null);
  const finishPolygonRef = useRef<(points: { x: number; y: number }[]) => void>(() => {});

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
    numberDraftsRef.current = {};
    setNumberDrafts({});
  }, [selectedId]);

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

  const creationKeyHeldRef = useRef(false);

  useEffect(() => {
    function clearDrawTool() {
      drawToolRef.current = null;
      drawDraftRef.current = null;
      setDrawTool(null);
      setDrawDraft(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "Enter") return;
      if (event.repeat || creationKeyHeldRef.current) {
        event.preventDefault();
        return;
      }
      const typing = event.target instanceof HTMLElement && !!event.target.closest("input, textarea");
      if (event.key === "Enter" && typing) return;
      creationKeyHeldRef.current = true;
      const tool = drawToolRef.current;
      if (!tool) return;
      if (tool === "polygon") {
        const draft = drawDraftRef.current;
        const points = draft?.kind === "polygon" ? draft.points : [];
        if (points.length >= 3) {
          finishPolygonRef.current(points);
          event.preventDefault();
          return;
        }
      }
      clearDrawTool();
      event.preventDefault();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter") creationKeyHeldRef.current = false;
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
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

  function editObject(patch: Record<string, unknown>) {
    if (!selected) return;
    let next = { ...selected, ...patch } as StoredObjectSchemaType;
    let saved = patch;
    if (selected.object === "polygon" && patch.points == null && (typeof patch.x === "number" || typeof patch.y === "number")) {
      const dx = (typeof patch.x === "number" ? patch.x : selected.x) - selected.x;
      const dy = (typeof patch.y === "number" ? patch.y : selected.y) - selected.y;
      next = {
        ...selected,
        x: selected.x + dx,
        y: selected.y + dy,
        points: selected.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
      saved = { x: next.x, y: next.y, points: next.points };
    }
    replaceObject(next);
    void savePatch(selected.id, saved);
  }

  function editNumber(field: string, raw: string, min = -Infinity) {
    numberDraftsRef.current = { ...numberDraftsRef.current, [field]: raw };
    setNumberDrafts(numberDraftsRef.current);
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value) || value < min) return;
    editObject({ [field]: value });
  }

  function commitNumber(field: string, raw: string, min = -Infinity) {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) {
      if (min <= 0) editObject({ [field]: 0 });
    } else if (value >= min) {
      editObject({ [field]: value });
    }
    const next = { ...numberDraftsRef.current };
    delete next[field];
    numberDraftsRef.current = next;
    setNumberDrafts(next);
  }

  function numberInput(field: string, current: number, min = -Infinity) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={numberDrafts[field] ?? String(current)}
        onChange={(event) => editNumber(field, event.target.value, min)}
        onBlur={(event) => commitNumber(field, event.currentTarget.value, min)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    );
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
    setEditingId(null);
  }

  function syncDraw(tool: DrawTool | null, draft: DrawDraft | null) {
    drawToolRef.current = tool;
    drawDraftRef.current = draft;
    setDrawTool(tool);
    setDrawDraft(draft);
  }

  function syncDraft(draft: DrawDraft | null) {
    drawDraftRef.current = draft;
    setDrawDraft(draft);
  }

  function commitPolygon(points: { x: number; y: number }[]) {
    if (points.length < 3) return;
    void addObject({
      object: "polygon",
      x: points[0].x,
      y: points[0].y,
      points,
      ...PAINT,
      fillOpacity: 0.85,
    });
    if (drawToolRef.current === "polygon") {
      syncDraft({ kind: "polygon", points: [], cursor: null });
    }
  }

  finishPolygonRef.current = commitPolygon;

  function placeDrag(draft: { kind: "circle" | "rect" | "textbox"; x0: number; y0: number; x1: number; y1: number }) {
    if (draft.kind === "circle") {
      const r = Math.hypot(draft.x1 - draft.x0, draft.y1 - draft.y0);
      if (r < 1) return;
      void addObject({ object: "circle", x: draft.x0, y: draft.y0, r, ...PAINT });
      return;
    }
    const box = dragBox(draft.x0, draft.y0, draft.x1, draft.y1);
    if (box.w < 1 || box.h < 1) return;
    if (draft.kind === "rect") {
      void addObject({ object: "rect", ...box, ...PAINT });
      return;
    }
    void addObject({
      object: "textbox",
      ...box,
      text: "Text",
      fontSize: 18,
      textColor: "#1f241c",
      ...PAINT,
    });
  }

  function chooseTool(tool: DrawTool) {
    const current = drawToolRef.current;
    const draft = drawDraftRef.current;
    if (current === "polygon" && draft?.kind === "polygon" && draft.points.length >= 3) {
      void addObject({
        object: "polygon",
        x: draft.points[0].x,
        y: draft.points[0].y,
        points: draft.points,
        ...PAINT,
        fillOpacity: 0.85,
      });
    }
    if (current === tool) {
      syncDraw(null, null);
      return;
    }
    syncDraw(tool, tool === "polygon" ? { kind: "polygon", points: [], cursor: null } : null);
    setSelectedId(null);
    setEditingId(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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

  function applyToolClick(worldX: number, worldY: number, clientX: number, clientY: number) {
    const tool = drawToolRef.current;
    const world = { x: worldX, y: worldY };
    if (tool === "polygon") {
      const draft = drawDraftRef.current;
      const points = draft?.kind === "polygon" ? draft.points : [];
      if (points.length >= 3) {
        const first = worldToBoard(points[0].x, points[0].y);
        const rect = boardRef.current?.getBoundingClientRect();
        const sx = clientX - (rect?.left ?? 0);
        const sy = clientY - (rect?.top ?? 0);
        if (Math.hypot(sx - first.sx, sy - first.sy) <= END_HIT_PX) {
          commitPolygon(points);
          return;
        }
      }
      if (points.length < 30) {
        const last = points[points.length - 1];
        if (!last || Math.hypot(world.x - last.x, world.y - last.y) >= 1) {
          syncDraft({ kind: "polygon", points: [...points, world], cursor: world });
        }
      }
      return;
    }
    if (tool === "arrow") {
      const draft = drawDraftRef.current;
      if (draft?.kind === "arrow") {
        if (Math.hypot(world.x - draft.x, world.y - draft.y) >= 1) {
          void addObject({
            object: "arrow",
            x: draft.x,
            y: draft.y,
            x2: world.x,
            y2: world.y,
            ...PAINT,
          });
          syncDraft(null);
        }
        return;
      }
      syncDraft({ kind: "arrow", x: world.x, y: world.y, x2: world.x, y2: world.y });
      return;
    }
    if (tool === "circle" || tool === "rect" || tool === "textbox") {
      const draft = drawDraftRef.current;
      if (draft && (draft.kind === "circle" || draft.kind === "rect" || draft.kind === "textbox")) {
        const placed = { kind: tool, x0: draft.x0, y0: draft.y0, x1: world.x, y1: world.y };
        const box = dragBox(draft.x0, draft.y0, world.x, world.y);
        const far = tool === "circle"
          ? Math.hypot(world.x - draft.x0, world.y - draft.y0) >= 1
          : box.w >= 1 && box.h >= 1;
        if (far) {
          placeDrag(placed);
          syncDraft(null);
        }
        return;
      }
      syncDraft({ kind: tool, x0: world.x, y0: world.y, x1: world.x, y1: world.y });
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (!(e.target instanceof Element && e.target.closest(".object-inspector"))) {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.closest(".object-inspector")) {
        active.blur();
      }
    }
    if (e.target instanceof Element && e.target.closest("textarea")) return;
    commitText();
    if (e.target instanceof Element && e.target.closest("button, .canvas-hud, .add-bar, .object-inspector")) {
      return;
    }
    e.preventDefault();
    const world = pointerWorld(e);
    const tool = drawToolRef.current;
    if (tool && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (tool) {
      e.currentTarget.setPointerCapture(e.pointerId);
      gestureRef.current = {
        kind: "press",
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        worldX: world.x,
        worldY: world.y,
        panX: camera.panX,
        panY: camera.panY,
      };
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect();
    const sx = e.clientX - (rect?.left ?? 0);
    const sy = e.clientY - (rect?.top ?? 0);

    if (selected) {
      const bounds = objectBounds(selected);
      const handle = worldToBoard(bounds.maxX, bounds.minY);
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

    const arrow = selected?.object === "arrow"
      ? selected
      : hitObject(world.x, world.y, objectsRef.current);
    if (arrow?.object === "arrow") {
      const tail = worldToBoard(arrow.x, arrow.y);
      const head = worldToBoard(arrow.x2, arrow.y2);
      const tailDist = Math.hypot(sx - tail.sx, sy - tail.sy);
      const headDist = Math.hypot(sx - head.sx, sy - head.sy);
      if (Math.min(tailDist, headDist) <= END_HIT_PX) {
        e.currentTarget.setPointerCapture(e.pointerId);
        gestureRef.current = {
          kind: "aim",
          pointerId: e.pointerId,
          id: arrow.id,
          end: tailDist <= headDist ? "tail" : "head",
          orig: arrow,
        };
        setSelectedId(arrow.id);
        setEditingId(null);
        return;
      }
    }

    const polygon = selected?.object === "polygon"
      ? selected
      : hitObject(world.x, world.y, objectsRef.current);
    if (polygon?.object === "polygon") {
      let nearest = -1;
      let nearestDist = END_HIT_PX;
      polygon.points.forEach((point, index) => {
        const screen = worldToBoard(point.x, point.y);
        const dist = Math.hypot(sx - screen.sx, sy - screen.sy);
        if (dist <= nearestDist) {
          nearest = index;
          nearestDist = dist;
        }
      });
      if (nearest >= 0) {
        e.currentTarget.setPointerCapture(e.pointerId);
        gestureRef.current = {
          kind: "vertex",
          pointerId: e.pointerId,
          id: polygon.id,
          index: nearest,
          orig: polygon,
        };
        setSelectedId(polygon.id);
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
    if (gesture?.kind === "press" && gesture.pointerId === e.pointerId) {
      if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) < CLICK_SLOP) return;
      gestureRef.current = {
        kind: "pan",
        pointerId: gesture.pointerId,
        startX: gesture.startX,
        startY: gesture.startY,
        panX: gesture.panX,
        panY: gesture.panY,
      };
      e.currentTarget.classList.add("is-panning");
    }

    const active = gestureRef.current;
    const tool = drawToolRef.current;
    const draft = drawDraftRef.current;
    if (active?.kind !== "pan" && active?.kind !== "press") {
      if (tool === "polygon" && draft?.kind === "polygon" && draft.points.length > 0) {
        syncDraft({ ...draft, cursor: pointerWorld(e) });
      } else if (draft && (
        (tool === "arrow" && draft.kind === "arrow") ||
        ((tool === "circle" || tool === "rect" || tool === "textbox") &&
          (draft.kind === "circle" || draft.kind === "rect" || draft.kind === "textbox"))
      )) {
        const world = pointerWorld(e);
        syncDraft(draft.kind === "arrow"
          ? { ...draft, x2: world.x, y2: world.y }
          : { ...draft, x1: world.x, y1: world.y });
      }
    }

    if (!active || active.pointerId !== e.pointerId) return;

    if (active.kind === "pan") {
      setCamera((current) => ({
        ...current,
        panX: active.panX + (e.clientX - active.startX),
        panY: active.panY + (e.clientY - active.startY),
      }));
      return;
    }
    if (active.kind === "press") return;

    const world = pointerWorld(e);
    if (active.kind === "aim" && active.orig.object === "arrow") {
      replaceObject(active.end === "tail"
        ? { ...active.orig, x: world.x, y: world.y }
        : { ...active.orig, x2: world.x, y2: world.y });
      return;
    }
    if (active.kind === "vertex" && active.orig.object === "polygon") {
      const points = active.orig.points.map((point, index) =>
        index === active.index ? { x: world.x, y: world.y } : point);
      replaceObject({ ...active.orig, x: points[0].x, y: points[0].y, points });
      return;
    }
    const next = active.kind === "move"
      ? movedObject(active.orig, world.x - active.startWorldX, world.y - active.startWorldY)
      : scaledObject(active.orig, world.x, world.y);
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

    if (gesture.kind === "press") {
      if (e.type === "pointerup") applyToolClick(gesture.worldX, gesture.worldY, gesture.startX, gesture.startY);
      return;
    }
    if (gesture.kind === "pan") return;
    const obj = objectsRef.current.find((item) => item.id === gesture.id);
    if (!obj) return;
    void savePatch(gesture.id, geometryPatch(obj));
  }

  function onDoubleClick(e: React.MouseEvent<HTMLElement>) {
    if (drawToolRef.current) return;
    if (e.target instanceof Element && e.target.closest("button, textarea, .canvas-hud, .add-bar, .object-inspector")) {
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
  const tailGrip = selected?.object === "arrow" ? toScreen(selected.x, selected.y) : null;
  const headGrip = selected?.object === "arrow" ? toScreen(selected.x2, selected.y2) : null;
  const vertexGrips = selected?.object === "polygon"
    ? selected.points.map((point) => toScreen(point.x, point.y))
    : [];
  const editorBox = editing?.object === "textbox" ? worldToBoard(editing.x, editing.y + editing.h) : null;
  const polygonDraft = drawDraft?.kind === "polygon" ? drawDraft : null;
  const polygonScreens = polygonDraft ? polygonDraft.points.map((point) => toScreen(point.x, point.y)) : [];
  const polygonCursor = polygonDraft?.cursor ? toScreen(polygonDraft.cursor.x, polygonDraft.cursor.y) : null;
  let drawPreview: StoredObjectSchemaType | null = null;
  if (drawDraft?.kind === "circle") {
    const r = Math.hypot(drawDraft.x1 - drawDraft.x0, drawDraft.y1 - drawDraft.y0);
    if (r >= 1) drawPreview = { id: "draft", object: "circle", x: drawDraft.x0, y: drawDraft.y0, r, ...PAINT };
  } else if (drawDraft?.kind === "rect" || drawDraft?.kind === "textbox") {
    const box = dragBox(drawDraft.x0, drawDraft.y0, drawDraft.x1, drawDraft.y1);
    if (box.w >= 1 && box.h >= 1) {
      drawPreview = drawDraft.kind === "rect"
        ? { id: "draft", object: "rect", ...box, ...PAINT }
        : { id: "draft", object: "textbox", ...box, text: "Text", fontSize: 18, textColor: "#1f241c", ...PAINT };
    }
  } else if (drawDraft?.kind === "arrow" && Math.hypot(drawDraft.x2 - drawDraft.x, drawDraft.y2 - drawDraft.y) >= 1) {
    drawPreview = {
      id: "draft",
      object: "arrow",
      x: drawDraft.x,
      y: drawDraft.y,
      x2: drawDraft.x2,
      y2: drawDraft.y2,
      ...PAINT,
    };
  }
  const drawHint = drawTool === "circle"
    ? (drawDraft?.kind === "circle" ? "Click the edge" : "Click the center")
    : drawTool === "rect"
      ? (drawDraft?.kind === "rect" ? "Click the last corner" : "Click the first corner")
      : drawTool === "textbox"
        ? (drawDraft?.kind === "textbox" ? "Click the last corner" : "Click the first corner")
        : drawTool === "arrow"
          ? (drawDraft?.kind === "arrow" ? "Click the arrow end" : "Click the arrow start")
          : drawTool === "polygon"
            ? (polygonDraft && polygonDraft.points.length >= 3
              ? "Press Enter or Escape to finish. Press either again to leave."
              : polygonDraft && polygonDraft.points.length > 0
                ? "Click to add points"
                : "Click to add points. Press Enter or Escape to leave.")
            : null;

  return (
    <section
      ref={boardRef}
      className={drawTool ? "canvas is-drawing" : "canvas"}
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
          <g pointerEvents="none">
            {drawPreview && <BoardShape obj={drawPreview} toScreen={toScreen} zoom={zoom} />}
            {(drawDraft?.kind === "arrow" || drawDraft?.kind === "circle" || drawDraft?.kind === "rect" || drawDraft?.kind === "textbox") && (
              <circle
                cx={toScreen(drawDraft.kind === "arrow" ? drawDraft.x : drawDraft.x0, drawDraft.kind === "arrow" ? drawDraft.y : drawDraft.y0).sx}
                cy={toScreen(drawDraft.kind === "arrow" ? drawDraft.x : drawDraft.x0, drawDraft.kind === "arrow" ? drawDraft.y : drawDraft.y0).sy}
                r={3.5}
                fill="#fbfbf8"
                stroke="#344b2d"
                strokeWidth={1.5}
              />
            )}
            {polygonScreens.length >= 3 && (
              <polygon
                points={polygonScreens.map((point) => `${point.sx},${point.sy}`).join(" ")}
                fill="#c5d4b4"
                fillOpacity={0.85}
                stroke="#344b2d"
                strokeWidth={2}
              />
            )}
            {polygonScreens.length === 2 && (
              <line
                x1={polygonScreens[0].sx}
                y1={polygonScreens[0].sy}
                x2={polygonScreens[1].sx}
                y2={polygonScreens[1].sy}
                stroke="#344b2d"
                strokeWidth={2}
              />
            )}
            {polygonCursor && polygonScreens.length > 0 && (
              <line
                x1={polygonScreens[polygonScreens.length - 1].sx}
                y1={polygonScreens[polygonScreens.length - 1].sy}
                x2={polygonCursor.sx}
                y2={polygonCursor.sy}
                stroke="#344b2d"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}
            {polygonScreens.map((point, index) => (
              <circle key={index} cx={point.sx} cy={point.sy} r={3.5} fill="#fbfbf8" stroke="#344b2d" strokeWidth={1.5} />
            ))}
          </g>
          {selection && selectionScreen && (
            <g className="selection" pointerEvents="none">
              <rect
                x={selectionScreen.sx}
                y={selectionScreen.sy}
                width={(selection.maxX - selection.minX) * zoom}
                height={(selection.maxY - selection.minY) * zoom}
              />
              {handleScreen && (
                <rect
                  className="scale-handle"
                  pointerEvents="all"
                  x={handleScreen.sx - 5}
                  y={handleScreen.sy - 5}
                  width={10}
                  height={10}
                />
              )}
              {vertexGrips.map((grip, index) => (
                <circle key={index} className="endpoint-handle" pointerEvents="all" cx={grip.sx} cy={grip.sy} r={3.5} />
              ))}
              {tailGrip && headGrip && (
                <>
                  <circle className="endpoint-handle" pointerEvents="all" cx={tailGrip.sx} cy={tailGrip.sy} r={3.5} />
                  <circle className="endpoint-handle" pointerEvents="all" cx={headGrip.sx} cy={headGrip.sy} r={3.5} />
                </>
              )}
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
        <button type="button" aria-pressed={drawTool === "circle"} onClick={() => chooseTool("circle")}>Circle</button>
        <button type="button" aria-pressed={drawTool === "rect"} onClick={() => chooseTool("rect")}>Rectangle</button>
        <button type="button" aria-pressed={drawTool === "polygon"} onClick={() => chooseTool("polygon")}>Polygon</button>
        <button type="button" aria-pressed={drawTool === "arrow"} onClick={() => chooseTool("arrow")}>Arrow</button>
        <button type="button" aria-pressed={drawTool === "textbox"} onClick={() => chooseTool("textbox")}>Textbox</button>
      </div>
      {drawHint && !selected && <div className="draw-hint">{drawHint}</div>}

      {selected && (
        <form className="object-inspector" aria-label="Object properties" onSubmit={(event) => event.preventDefault()}>
          <div className="inspector-title">{selected.object}</div>
          <label>X{numberInput("x", selected.x)}</label>
          <label>Y{numberInput("y", selected.y)}</label>
          {selected.object === "polygon" && (
            <div className="point-stepper">
              <span>Points</span>
              <div>
                <button
                  type="button"
                  aria-label="Remove point"
                  disabled={selected.points.length <= 3}
                  onClick={() => {
                    const points = withPointCount(selected.points, selected.points.length - 1);
                    editObject({ x: points[0].x, y: points[0].y, points });
                  }}
                >−</button>
                <span>{selected.points.length}</span>
                <button
                  type="button"
                  aria-label="Add point"
                  disabled={selected.points.length >= 30}
                  onClick={() => {
                    const points = withPointCount(selected.points, selected.points.length + 1);
                    editObject({ x: points[0].x, y: points[0].y, points });
                  }}
                >+</button>
              </div>
            </div>
          )}
          {selected.object === "arrow" && (
            <>
              <label>Tip X{numberInput("x2", selected.x2)}</label>
              <label>Tip Y{numberInput("y2", selected.y2)}</label>
            </>
          )}
          {selected.object === "circle" && (
            <label>Radius{numberInput("r", selected.r, 1)}</label>
          )}
          {(selected.object === "rect" || selected.object === "textbox") && (
            <>
              <label>Width{numberInput("w", selected.w, 1)}</label>
              <label>Height{numberInput("h", selected.h, 1)}</label>
            </>
          )}
          {selected.object === "textbox" && (
            <>
              <label>Text<input type="text" value={selected.text} onChange={(event) => { if (event.target.value) editObject({ text: event.target.value }); }} /></label>
              <label>Font{numberInput("fontSize", selected.fontSize, 1)}</label>
              <label>Text color<input type="color" value={selected.textColor} onChange={(event) => editObject({ textColor: event.target.value })} /></label>
            </>
          )}
          <label>Stroke<input type="color" value={selected.strokeColor} onChange={(event) => editObject({ strokeColor: event.target.value })} /></label>
          <label>Fill<input type="color" value={selected.fillColor} onChange={(event) => editObject({ fillColor: event.target.value })} /></label>
          <label>Stroke width{numberInput("strokeWidth", selected.strokeWidth, 0)}</label>
        </form>
      )}

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
