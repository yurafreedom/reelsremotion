// Lightweight toast/status system (v3.2 A1). Every media action surfaces VISIBLE
// state here — "Uploading…", "Added", or a clear error with the reason — so an
// upload can never fail silently again. A "sticky" toast (e.g. the in-flight
// "Uploading…") stays until it is `update`d to a terminal state, which then
// auto-dismisses. Errors linger longer so the reason is readable.

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; kind: ToastKind; message: string };

const AUTODISMISS: Record<ToastKind, number> = {
  info: 2500,
  success: 2500,
  error: 6500,
};

export type ToastApi = {
  /** Show a toast; returns its id. `sticky` keeps it until `update`/`dismiss`. */
  show: (kind: ToastKind, message: string, sticky?: boolean) => number;
  /** Replace an existing toast's kind/message (and re-arm auto-dismiss). */
  update: (id: number, kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

/** Hook for any component to raise status. Safe to call outside the provider
 *  (no-ops) so non-UI helpers can accept the api without a hard dependency. */
export const useToast = (): ToastApi => {
  const api = useContext(ToastCtx);
  return api ?? NOOP;
};

const NOOP: ToastApi = { show: () => -1, update: () => {}, dismiss: () => {} };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = (id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  };

  const dismiss = useCallback((id: number) => {
    clearTimer(id);
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const arm = useCallback(
    (id: number, kind: ToastKind) => {
      clearTimer(id);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTODISMISS[kind])
      );
    },
    [dismiss]
  );

  const show = useCallback(
    (kind: ToastKind, message: string, sticky = false) => {
      const id = idRef.current++;
      setToasts((cur) => [...cur, { id, kind, message }]);
      if (!sticky) arm(id, kind);
      return id;
    },
    [arm]
  );

  const update = useCallback(
    (id: number, kind: ToastKind, message: string) => {
      setToasts((cur) => cur.map((t) => (t.id === id ? { ...t, kind, message } : t)));
      arm(id, kind);
    },
    [arm]
  );

  const api: ToastApi = { show, update, dismiss };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)} role="status">
            <span className="toast-dot" />
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
