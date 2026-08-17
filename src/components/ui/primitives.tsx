"use client";

import * as React from "react";
import { X } from "lucide-react";

/**
 * Small shadcn-style UI primitives on Tailwind tokens. Kept in one module —
 * they carry presentation only, never business logic.
 */

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ----------------------------- Button ----------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ className, variant = "secondary", ...props }, ref) {
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-accent text-white hover:bg-accent-deep border border-transparent",
    secondary:
      "bg-surface text-ink border border-hairline hover:bg-page",
    ghost: "bg-transparent text-ink-2 hover:bg-page border border-transparent",
    danger:
      "bg-surface text-critical border border-hairline hover:bg-red-50",
  };
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none cursor-pointer",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------ Card ------------------------------ */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-lg border border-hairline bg-surface shadow-[0_1px_2px_rgba(11,11,11,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ----------------------------- Inputs ----------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "h-8 rounded-md border border-hairline bg-surface px-2.5 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-accent/50",
        className,
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-8 rounded-md border border-hairline bg-surface px-2 text-sm text-ink focus:outline-2 focus:outline-accent/50 cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx("text-xs font-medium text-ink-2", className)}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
        checked ? "bg-accent" : "bg-axis",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ------------------------------ Badge ----------------------------- */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "good" | "warning" | "critical";
  className?: string;
}) {
  const tones = {
    neutral: "bg-page text-ink-2 border-hairline",
    accent: "bg-accent-soft text-accent-deep border-transparent",
    good: "bg-green-50 text-good-text border-transparent",
    warning: "bg-amber-50 text-amber-800 border-transparent",
    critical: "bg-red-50 text-critical border-transparent",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ Chip ------------------------------ */

export function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-deep">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-white/60 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ----------------------------- Dialog ----------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 pt-[6vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cx(
          "w-full rounded-lg border border-hairline bg-surface shadow-xl",
          wide ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between border-b border-grid px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-page hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------- EmptyState --------------------------- */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-axis bg-surface px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-md text-xs text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}
