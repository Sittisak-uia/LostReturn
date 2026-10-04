import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:brightness-105 border border-amber-300/40",
        destructive:
          "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm",
        outline:
          "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm",
        secondary:
          "bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80 border border-zinc-200/60 shadow-sm font-medium",
        ghost:
          "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800",
        link:
          "text-amber-600 underline-offset-4 hover:underline font-medium",
        hero:
          "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-900 font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] border border-amber-300/50",
        success:
          "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm",
        glass:
          "backdrop-blur-xl bg-white/80 border border-zinc-200 text-zinc-800 hover:bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-13 rounded-2xl px-8 text-base font-semibold",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
