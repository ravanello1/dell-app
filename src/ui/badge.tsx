import { cn } from "@/core/utils/cn";
import type { ComponentProps } from "react";

const tones = {
  neutral: "bg-surface-sunken text-ink-700 ring-line-strong",
  gold: "bg-gold-50 text-gold-800 ring-gold-300",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  success: "bg-success-soft text-success ring-success/25",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
  info: "bg-info-soft text-info ring-info/25",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
