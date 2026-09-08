// ui.tsx — Shared studio primitives: buttons, fields, modal, clipboard helper.
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import { Check, Copy, X } from "lucide-react";

// --- Clipboard --------------------------------------------------------------

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// --- Class tokens -------------------------------------------------------------

export const fieldClass =
  "w-full rounded-md border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-[13px] leading-snug text-neutral-200 placeholder:text-neutral-600 transition-colors focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-40";

export const selectClass = clsx(fieldClass, "cursor-pointer pr-7 [&>option]:bg-neutral-900 [&>option]:text-neutral-200");

// --- Buttons -------------------------------------------------------------------

type ButtonVariant = "primary" | "ghost" | "danger" | "success" | "subtle";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-amber-500 text-neutral-950 hover:bg-amber-400",
  ghost: "border border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600 hover:text-neutral-100",
  danger: "border border-red-900/60 bg-red-950/40 text-red-400 hover:bg-red-900/40 hover:text-red-300",
  success: "bg-emerald-600 text-neutral-950 hover:bg-emerald-500",
  subtle: "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-6 gap-1 px-2 text-[11px]",
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-1.5 px-3 text-[13px]",
  lg: "h-9 gap-2 px-4 text-sm",
  icon: "h-6 w-6 p-0",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "ghost", size = "sm", className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
        "disabled:pointer-events-none disabled:opacity-40",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...rest}
    />
  );
}

// --- Form fields ------------------------------------------------------------------

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500", className)}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="block text-[11px] leading-snug text-neutral-600">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClass, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldClass, "resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(selectClass, className)} {...rest}>
      {children}
    </select>
  );
}

// --- Chip ---------------------------------------------------------------------------

export function Chip({ children, className, tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "amber" | "dim" | "danger" | "green" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none",
        tone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
        tone === "default" && "border-neutral-800 bg-neutral-900 text-neutral-400",
        tone === "dim" && "border-neutral-800/60 bg-transparent text-neutral-600",
        tone === "danger" && "border-red-900/50 bg-red-950/40 text-red-300",
        tone === "green" && "border-emerald-600/40 bg-emerald-500/10 text-emerald-300",
        className
      )}
    >
      {children}
    </span>
  );
}

// --- Modal -----------------------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, wide }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={clsx(
          "flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/70",
          wide ? "max-w-3xl" : "max-w-md"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</p>}
          </div>
          <Button variant="subtle" size="icon" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// --- Copy button ---------------------------------------------------------------------------

interface CopyButtonProps {
  text: string;
  label?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
}

export function CopyButton({ text, label = "Copy", size = "sm", variant = "primary", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={copied ? "success" : variant}
      size={size}
      className={className}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      aria-live="polite"
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </Button>
  );
}

// --- Misc -----------------------------------------------------------------------------------

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-block animate-spin rounded-full border-2 border-neutral-600 border-t-amber-400", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
