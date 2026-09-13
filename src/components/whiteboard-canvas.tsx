"use client";

import { useEffect, useRef, useState } from "react";

type BoardObject = {
  id: string;
  shape: "circle" | "rect";
  color: string;
  x: number;
  y: number;
};

const SCALE = 1; // 1 world unit = 1px
const GRID = 50;

export default function WhiteboardCanvas() {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [objects] = useState<BoardObject[]>([
    { id: "1", shape: "circle", color: "#344b2d", x: 100, y: 100 },
    { id: "2", shape: "rect", color: "#344b2d", x: 500, y: 150 },
  ]);

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

  function toScreen(x: number, y: number) {
    return {
      sx: x * SCALE,
      sy: size.height - y * SCALE,
    };
  }

  const { width, height } = size;

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

        {objects.map((obj) => {
          const { sx, sy } = toScreen(obj.x, obj.y);
          if (obj.shape === "circle") {
            return (
              <circle key={obj.id} cx={sx} cy={sy} r={12} fill={obj.color} />
            );
          } else if (obj.shape === "rect") {
            return (
              <rect key={obj.id} x={sx} y={sy - 24} width={24} height={24} fill={obj.color} />
            );
          }
        })}

      </svg>

    </section>
  );
}
