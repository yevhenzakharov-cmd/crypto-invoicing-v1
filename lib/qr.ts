import QRCode from "qrcode";

export type QrStyle = "plain" | "modern" | "elegant" | "artistic";
export const QR_STYLES: { id: QrStyle; label: string }[] = [
  { id: "plain", label: "Plain" },
  { id: "modern", label: "Modern" },
  { id: "elegant", label: "Elegant" },
  { id: "artistic", label: "Artistic" },
];

/**
 * Data modules always stay solid, touching squares — that is what keeps every
 * style reliably scannable. Styles vary colour and the corner "eyes" only.
 */
const STYLE = {
  plain: { color: "#000000", finder: "square" },
  modern: { color: "#111111", finder: "rounded" },
  elegant: { color: "#1F3F99", finder: "rounded" },
  artistic: { color: "#8E1145", finder: "circle" },
} as const;

type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { t: "ring"; cx: number; cy: number; outer: number; inner: number; round: "square" | "rounded" | "circle" }
  | { t: "circle"; cx: number; cy: number; r: number };

const QUIET = 4;

function isFinder(r: number, c: number, n: number) {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

/** Builds a scalable list of shapes for the QR code in the given style. */
export function qrShapes(text: string, style: QrStyle): { size: number; color: string; shapes: Shape[] } {
  const s = STYLE[style];
  // Extra error correction for the styled variants (shaped eyes, colour).
  const qr = QRCode.create(text, { errorCorrectionLevel: style === "plain" ? "M" : "Q" });
  const n = qr.modules.size;
  const get = (r: number, c: number) => qr.modules.get(r, c) === 1 || (qr.modules.get(r, c) as unknown) === true;
  const shapes: Shape[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isFinder(r, c, n) || !get(r, c)) continue;
      const x = c + QUIET, y = r + QUIET;
      shapes.push({ t: "rect", x, y, w: 1, h: 1, r: 0 });
    }
  }
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const cx = c + QUIET + 3.5, cy = r + QUIET + 3.5;
    shapes.push({ t: "ring", cx, cy, outer: 3.5, inner: 2.5, round: s.finder });
    if (s.finder === "circle") shapes.push({ t: "circle", cx, cy, r: 1.5 });
    else shapes.push({ t: "rect", x: cx - 1.5, y: cy - 1.5, w: 3, h: 3, r: s.finder === "rounded" ? 0.6 : 0 });
  }
  return { size: n + QUIET * 2, color: s.color, shapes };
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}
function circlePath(cx: number, cy: number, r: number, reverse = false) {
  const sweep = reverse ? 0 : 1;
  return `M${cx - r} ${cy}a${r} ${r} 0 1 ${sweep} ${2 * r} 0a${r} ${r} 0 1 ${sweep} ${-2 * r} 0z`;
}

/** Self-contained SVG markup (generated locally, no user HTML inside). */
export function qrSvg(text: string, style: QrStyle): string {
  const { size, color, shapes } = qrShapes(text, style);
  const parts: string[] = [];
  for (const sh of shapes) {
    if (sh.t === "rect") parts.push(roundedRectPath(sh.x, sh.y, sh.w, sh.h, sh.r));
    else if (sh.t === "circle") parts.push(circlePath(sh.cx, sh.cy, sh.r));
    else {
      const o = sh.outer, i = sh.inner;
      if (sh.round === "circle") parts.push(circlePath(sh.cx, sh.cy, o) + circlePath(sh.cx, sh.cy, i, true));
      else {
        const ro = sh.round === "rounded" ? 1.2 : 0, ri = sh.round === "rounded" ? 0.8 : 0;
        parts.push(roundedRectPath(sh.cx - o, sh.cy - o, 2 * o, 2 * o, ro));
        // inner hole drawn counter-clockwise via evenodd fill rule
        parts.push(roundedRectPath(sh.cx - i, sh.cy - i, 2 * i, 2 * i, ri));
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="geometricPrecision"><rect width="${size}" height="${size}" fill="#fff"/><path fill="${color}" fill-rule="evenodd" d="${parts.join("")}"/></svg>`;
}

/** PNG data URL for embedding in the PDF (browser only). */
export async function qrPngDataUrl(text: string, style: QrStyle, px = 600): Promise<string> {
  const svg = qrSvg(text, style);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("QR render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, px, px);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
