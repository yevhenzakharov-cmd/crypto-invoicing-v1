"use client";

import { useMemo } from "react";
import { qrSvg, type QrStyle } from "@/lib/qr";

/** Renders a QR code as locally generated SVG (no network, no user HTML). */
export function QrPreview({ text, style, size = 168, label }: { text: string; style: QrStyle; size?: number; label: string }) {
  const svg = useMemo(() => (text ? qrSvg(text, style) : ""), [text, style]);
  if (!svg) return null;
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size, background: "#fff", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
