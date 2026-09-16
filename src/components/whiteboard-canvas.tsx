"use client";

import { useEffect, useRef, useState } from "react";
import BoardShape from "@/components/shapes/board-shape";
import { StoredObjectSchemaValue } from "@/lib/whiteboard/schemas";

const SCALE = 1; // 1 world unit = 1px
const GRID = 50;
const GRID_PX = GRID * SCALE;

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

  function applyPan(x: number, y: number) {
    panRef.current = { x, y };
    worldRef.current?.setAttribute("transform", `translate(${x} ${y})`);
    const canvas = ref.current;
    if (canvas) {
      canvas.style.backgroundPosition = `${x}px ${y + (canvas.clientHeight % GRID_PX)}px`;
    }
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
          <text x={8} y={height - 8} fill="#858c7e" fontSize={12}>
            (0, 0)
          </text>
          {objects.map((obj) => (
            <BoardShape key={obj.id} obj={obj} toScreen={toScreen} />
          ))}
        </g>

        <text
          x={width - 8}
          y={16}
          fill="#858c7e"
          fontSize={12}
          textAnchor="end"
        >
          ({Math.round(width / SCALE)}, {Math.round(height / SCALE)})
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
