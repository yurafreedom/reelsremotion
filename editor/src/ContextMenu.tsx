import React, { useEffect, useRef } from "react";

// A tiny reusable right-click menu. Purely presentational: the caller builds the
// item list (label + action) per element type. Closes on outside click / Escape /
// after an item runs.
export type MenuItem =
  | { kind: "item"; label: string; onClick: () => void; danger?: boolean }
  | { kind: "sep" };

export type MenuState = { x: number; y: number; items: MenuItem[] } | null;

export const ContextMenu: React.FC<{ menu: MenuState; onClose: () => void }> = ({
  menu,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  // Keep the menu on-screen.
  const x = Math.min(menu.x, window.innerWidth - 200);
  const y = Math.min(menu.y, window.innerHeight - menu.items.length * 28 - 8);
  return (
    <div ref={ref} className="ctx-menu" style={{ position: "fixed", left: x, top: y, zIndex: 1000 }}>
      {menu.items.map((it, i) =>
        it.kind === "sep" ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            className={"ctx-item" + (it.danger ? " danger" : "")}
            onClick={() => {
              it.onClick();
              onClose();
            }}
          >
            {it.label}
          </button>
        )
      )}
    </div>
  );
};
