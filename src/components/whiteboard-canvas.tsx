"use client";

import { useEffect, useRef, useState } from "react";
import BoardShape from "@/components/shapes/board-shape";
import type { BoardObject } from "@/components/shapes/types";

const SCALE = 1; // 1 world unit = 1px
const GRID = 50;

export default function WhiteboardCanvas() {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [objects, setObjects] = useState<BoardObject[]>([]);
  const { width, height } = size;

  // fetch object data
  useEffect(() => {
    async function getObjects() {
      const response = await fetch("/api/objects")
      const result = await response.json();
      setObjects(result);
    }

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

  // convert world coordinates to screen coordinates
  function toScreen(x: number, y: number) {
    return {
      sx: x * SCALE,
      sy: size.height - y * SCALE,
    };
  }

  return (
    <section ref={ref} className="canvas" aria-label="Whiteboard canvas">
      <svg width={width} height={height}>

        {/* vertical lines */}
        {Array.from({ length: Math.ceil(width / GRID) + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * GRID}
            y1={0}
            x2={i * GRID}
            y2={height}
            stroke="#eee"
          />
        ))}
        {/* horizontal lines */}
        {Array.from({ length: Math.ceil(height / GRID) + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={height - i * GRID}
            x2={width}
            y2={height - i * GRID}
            stroke="#eee"
          />
        ))}

        {/* coordinate endpoint text */}
        <text x={8} y={height - 8} fill="#858c7e" fontSize={12}>
          (0, 0)
        </text>
        <text
          x={width - 8}
          y={16}
          fill="#858c7e"
          fontSize={12}
          textAnchor="end"
        >
          ({Math.round(width / SCALE)}, {Math.round(height / SCALE)})
        </text>

        {/* render objects */}
        {objects.map((obj) => (
          <BoardShape key={obj.id} obj={obj} toScreen={toScreen} />
        ))}

      </svg>
    </section>
  );
}
