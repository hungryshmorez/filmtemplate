// ConfirmDialog.tsx — Promise-based confirm() replacement.
// window.confirm() is silently blocked (returns without prompting, or throws)
// inside the sandboxed preview iframe, which made every delete button in the
// app appear to do nothing. This provides an in-DOM modal confirm that works
// regardless of iframe sandboxing.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./ui";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Set false for non-destructive confirmations (defaults to true / red button). */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const options: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={() => settle(false)}
          role="alertdialog"
          aria-modal="true"
          aria-label={pending.title ?? "Confirm"}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/70"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-neutral-800 px-4 py-3">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-100">{pending.title ?? "Are you sure?"}</h2>
                <p className="mt-1 text-[12.5px] leading-snug text-neutral-400">{pending.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={pending.danger === false ? "primary" : "danger"}
                size="sm"
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel ?? "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
