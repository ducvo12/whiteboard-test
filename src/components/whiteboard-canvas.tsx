"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BoardShape from "@/components/shapes/board-shape";
import CanvasHud from "@/components/canvas-hud";
import { StoredObjectSchemaType } from "@/lib/whiteboard/schemas";
import {
  AXIS_EXTENT,
  GRID,
  ZOOM_STEP,
  type Camera,
  cameraToFit,
  formatWorld,
  screenToWorld,
  unionBounds,
  zoomAtScreenPoint,
} from "@/lib/whiteboard/geometry";

const MOBILE_QUERY = "(max-width: 720px)";
const POLL_MS = 800;

function panelInsets(chatOpen: boolean, viewH: number) {
  if (!chatOpen) return { right: 0, bottom: 0 };
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return { right: 0, bottom: 12 + Math.min(viewH * 0.62, 560) };
  }
  return { right: 352, bottom: 0 };
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
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ panX: 0, panY: 0, zoom: 1 });
  const [objects, setObjects] = useState<StoredObjectSchemaType[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { width, height } = size;
  const { panX, panY, zoom } = camera;

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/objects");
        const result = await response.json();
        if (!cancelled && Array.isArray(result)) setObjects(result);
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

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("button, .canvas-hud")) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: camera.panX,
      panY: camera.panY,
    };
    e.currentTarget.classList.add("is-panning");
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setCamera((current) => ({
      ...current,
      panX: drag.panX + (e.clientX - drag.startX),
      panY: drag.panY + (e.clientY - drag.startY),
    }));
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.currentTarget.classList.remove("is-panning");
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
        </g>
      </svg>

      {loaded && objects.length === 0 && (
        <p className="canvas-empty">
          {agentWorking
            ? "Working on the board…"
            : "Ask AI to put something here."}
        </p>
      )}

      {agentWorking && objects.length > 0 && (
        <div className="working-chip">Working on the board…</div>
      )}

      <div className="coord-origin">{formatWorld(origin.x, origin.y)}</div>
      <div className="coord-extent">{formatWorld(extent.x, extent.y)}</div>

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
