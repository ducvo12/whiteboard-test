"use client";

import { useEffect, useRef, useState } from "react";
import BoardShape from "@/components/shapes/board-shape";
import { StoredObjectSchemaValue } from "@/lib/whiteboard/schemas";

const SCALE = 1; // 1 world unit = 1px
const GRID = 50;
const GRID_PX = GRID * SCALE;
const AXIS_EXTENT = 50000;

function screenToWorld(
  sx: number,
  sy: number,
  panX: number,
  panY: number,
  viewH: number,
) {
  return {
    x: (sx - panX) / SCALE,
    y: (viewH - sy + panY) / SCALE,
  };
}

function formatWorld(x: number, y: number) {
  return `(${Math.round(x)}, ${Math.round(y)})`;
}

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
};

export default function WhiteboardCanvas() {
  const ref = useRef<HTMLElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const originLabelRef = useRef<SVGTextElement>(null);
  const extentLabelRef = useRef<SVGTextElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [objects, setObjects] = useState<StoredObjectSchemaValue[]>([]);
  const { width, height } = size;

  // fetch object data
  async function getObjects() {
    const response = await fetch("/api/objects");
    const result = await response.json();
    setObjects(result);
  }
  useEffect(() => {
    getObjects();
  }, []);

  // update size when canvas resizes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function syncCornerLabels(panX: number, panY: number, viewW: number, viewH: number) {
    const origin = screenToWorld(0, viewH, panX, panY, viewH);
    const extent = screenToWorld(viewW, 0, panX, panY, viewH);
    const originLabel = originLabelRef.current;
    const extentLabel = extentLabelRef.current;
    if (originLabel) originLabel.textContent = formatWorld(origin.x, origin.y);
    if (extentLabel) extentLabel.textContent = formatWorld(extent.x, extent.y);
  }

  function applyPan(x: number, y: number) {
    panRef.current = { x, y };
    worldRef.current?.setAttribute("transform", `translate(${x} ${y})`);
    const canvas = ref.current;
    const viewW = canvas?.clientWidth ?? width;
    const viewH = canvas?.clientHeight ?? height;
    if (canvas) {
      canvas.style.backgroundPosition = `${x}px ${y + (viewH % GRID_PX)}px`;
    }
    syncCornerLabels(x, y, viewW, viewH);
  }

  function endPan(el: HTMLElement, pointerId: number) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    dragRef.current = null;
    if (el.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    el.classList.remove("is-panning");
    worldRef.current?.style.removeProperty("will-change");
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("button")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    e.currentTarget.classList.add("is-panning");
    worldRef.current?.style.setProperty("will-change", "transform");
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    applyPan(
      drag.panX + (e.clientX - drag.startX),
      drag.panY + (e.clientY - drag.startY),
    );
  }

  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    endPan(e.currentTarget, e.pointerId);
  }

  // convert world coordinates to screen coordinates
  function toScreen(x: number, y: number) {
    return {
      sx: x * SCALE,
      sy: height - y * SCALE,
    };
  }

  const { x: panX, y: panY } = panRef.current;
  const origin = screenToWorld(0, height, panX, panY, height);
  const extent = screenToWorld(width, 0, panX, panY, height);

  return (
    <section
      ref={ref}
      className="canvas"
      aria-label="Whiteboard canvas"
      style={{
        backgroundImage: `linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)`,
        backgroundSize: `${GRID_PX}px ${GRID_PX}px`,
        backgroundPosition: `${panX}px ${panY + (height % GRID_PX)}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
    >
      <svg width={width} height={height}>
        <g ref={worldRef} transform={`translate(${panX} ${panY})`}>
          <line
            x1={-AXIS_EXTENT}
            y1={height}
            x2={AXIS_EXTENT}
            y2={height}
            stroke="#ccc"
            strokeWidth={2}
          />
          <line
            x1={0}
            y1={-AXIS_EXTENT}
            x2={0}
            y2={AXIS_EXTENT}
            stroke="#ccc"
            strokeWidth={2}
          />
          {objects.map((obj) => (
            <BoardShape key={obj.id} obj={obj} toScreen={toScreen} />
          ))}
        </g>

        <text
          ref={originLabelRef}
          x={8}
          y={height - 8}
          fill="#858c7e"
          fontSize={12}
        >
          {formatWorld(origin.x, origin.y)}
        </text>
        <text
          ref={extentLabelRef}
          x={width - 8}
          y={16}
          fill="#858c7e"
          fontSize={12}
          textAnchor="end"
        >
          {formatWorld(extent.x, extent.y)}
        </text>
      </svg>

      <button
        onClick={getObjects}
        className="absolute bottom-4 right-4 z-10"
      >
        refresh
      </button>
    </section>
  );
}
