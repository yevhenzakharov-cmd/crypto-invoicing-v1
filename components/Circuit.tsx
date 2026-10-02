"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Circuit-trace section lines (design option C1).
 *
 * The SVG is drawn in real pixels from the element's measured size, so the
 * lines stay straight and crisp at any width. Paths use pathLength="1000",
 * which lets the travelling "packet" animation be defined once in CSS.
 * Purely decorative: aria-hidden, no pointer events, still under
 * prefers-reduced-motion.
 */

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function Gradient({ id, w }: { id: string; w: number }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#F07D96" />
        <stop offset="1" stopColor="#6FD1C3" />
      </linearGradient>
    </defs>
  );
}

/**
 * Wraps a section (the hero). Traces run down both edges and meet at a
 * pulsing node in the middle of the bottom edge, which is the divider into
 * the next section.
 */
export function CircuitFrame({ children }: { children: ReactNode }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  let paths: { left: string; right: string; cx: number; cy: number } | null = null;
  if (size && size.w > 0) {
    const { w, h } = size;
    const x0 = 0.5, x1 = w - 0.5, cx = Math.round(w / 2), bottom = h - 0.5;
    const jog = Math.min(64, w * 0.06);
    // keep the right-side step inside the frame's padding, clear of content
    const inset = w < 720 ? 8 : 20;
    paths = {
      // down the left edge → across → small step down → along the divider to the right edge
      left: `M${x0} 0 V${bottom - 40} H${cx - jog * 1.25} V${bottom} H${x1}`,
      // down the right edge → jog in → down → across → into the centre node
      right: `M${x1} 0 V${Math.round(h * 0.55)} H${x1 - inset} V${bottom - 40} H${cx + jog * 1.25} V${bottom}`,
      cx,
      cy: bottom,
    };
  }
  return (
    <div ref={ref} className="circuit-frame">
      {paths && size && (
        <svg className="circuit-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true" focusable="false">
          <Gradient id={gid} w={size.w} />
          <path className="trace-base" d={paths.left} />
          <path className="trace-base" d={paths.right} />
          <path className="trace-packet pink" d={paths.left} pathLength={1000} />
          <path className="trace-packet teal" d={paths.right} pathLength={1000} />
          <circle cx={0.5} cy={size.h - 40.5} r={3.5} fill="#000" stroke="#7A7A84" />
          <circle cx={size.w - 0.5} cy={Math.round(size.h * 0.55)} r={3.5} fill="#000" stroke="#7A7A84" />
          <circle className="trace-node" cx={paths.cx} cy={paths.cy} r={5} fill="#000" stroke={`url(#${gid})`} strokeWidth={1.5} />
        </svg>
      )}
      {children}
    </div>
  );
}

/** A standalone divider between later sections: one trace with a centre node. */
export function CircuitDivider({ flip = false }: { flip?: boolean }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  let d = "";
  let node = { x: 0, y: 0 };
  if (size && size.w > 0) {
    const { w, h } = size;
    const cx = Math.round(w / 2);
    const mid = Math.round(h / 2) + 0.5;
    d = flip
      ? `M${w - 0.5} 0 V${mid} H${cx + 48} V${h - 0.5} H0.5`
      : `M0.5 0 V${mid} H${cx - 48} V${h - 0.5} H${w - 0.5}`;
    node = { x: cx, y: h - 0.5 };
  }
  return (
    <div ref={ref} className="circuit-divider" aria-hidden="true">
      {size && d && (
        <svg className="circuit-svg" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} focusable="false">
          <Gradient id={gid} w={size.w} />
          <path className="trace-base" d={d} />
          <path className={`trace-packet ${flip ? "teal" : "pink"}`} d={d} pathLength={1000} />
          <circle className="trace-node" cx={node.x} cy={node.y} r={5} fill="#000" stroke={`url(#${gid})`} strokeWidth={1.5} />
          <rect x={flip ? size.w - 28 : 20} y={size.h - 8} width={8} height={8} fill="#000" stroke="#7A7A84" />
        </svg>
      )}
    </div>
  );
}
