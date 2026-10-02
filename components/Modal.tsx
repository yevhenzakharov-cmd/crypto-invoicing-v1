"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, button, select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal panel" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="panel-head">
          <h2 id={id} style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} style={{ width: 36, height: 36 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
      </div>
    </div>
  );
}
