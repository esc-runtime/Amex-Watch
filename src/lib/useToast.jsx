/**
 * Toast banners — short messages that slide in at the top and leave on
 * their own.
 *
 *   const toast = useToast();
 *   toast.success("Signed in successfully.");
 *   toast.error("Couldn't refresh jobs. Please try again later.");
 *   toast.info("This is taking longer than usual.");
 *
 * The provider sits above the whole app, so a toast survives the screen
 * changing underneath it — signing in swaps the login screen for the job
 * list, and the "Signed in" banner is still there when it does.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

/** Errors stay longer — they're the ones people need time to read. */
const DURATION_MS = { success: 3500, info: 4500, error: 6000 };

/** Older banners drop off if several arrive at once. */
const MAX_VISIBLE = 3;

const ICON = { success: "✓", error: "!", info: "i" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type, message) => {
      nextId.current += 1;
      const id = nextId.current;

      setToasts((prev) => [...prev, { id, type, message }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS[type])
      );
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            role={t.type === "error" ? "alert" : "status"}
          >
            <span className="toast-icon" aria-hidden="true">
              {ICON[t.type]}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
