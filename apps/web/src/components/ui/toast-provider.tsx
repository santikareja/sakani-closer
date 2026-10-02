"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface PromiseMessages {
  loading: string;
  success: string;
  error: string;
}

interface ToastContextValue {
  notify(message: string, tone?: ToastTone): void;
  promise<T>(operation: Promise<T>, messages: PromiseMessages): Promise<T>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = Date.now() + Math.floor(Math.random() * 1_000);
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => remove(id), 4_500);
    },
    [remove],
  );

  const promise = useCallback(
    async <T,>(operation: Promise<T>, messages: PromiseMessages): Promise<T> => {
      notify(messages.loading);
      try {
        const result = await operation;
        notify(messages.success, "success");
        return result;
      } catch (error) {
        notify(messages.error, "error");
        throw error;
      }
    },
    [notify],
  );

  const value = useMemo(() => ({ notify, promise }), [notify, promise]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ol className="toast-region" aria-live="polite" aria-label="Notifikasi">
        {toasts.map((toast) => (
          <li className={`toast toast-${toast.tone}`} key={toast.id}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => remove(toast.id)} aria-label="Tutup notifikasi">
              Tutup
            </button>
          </li>
        ))}
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
