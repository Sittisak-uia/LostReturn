'use client';
import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white px-3.5 py-2 text-base md:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-900 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
