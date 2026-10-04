import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide transition-all backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-amber-300/80 bg-amber-50 text-amber-800 shadow-sm",
        secondary:
          "border-zinc-200 bg-zinc-100 text-zinc-800",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700 shadow-sm",
        outline:
          "border-zinc-300 text-zinc-800 bg-white",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm",
        warning:
          "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
        empty:
          "border-emerald-300/80 bg-emerald-50 text-emerald-700 shadow-[0_2px_8px_rgba(16,185,129,0.12)]",
        occupied:
          "border-amber-300/80 bg-amber-50 text-amber-800 shadow-[0_2px_8px_rgba(245,158,11,0.15)]",
        locked:
          "border-rose-200 bg-rose-50 text-rose-700 shadow-[0_2px_8px_rgba(244,63,94,0.12)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };