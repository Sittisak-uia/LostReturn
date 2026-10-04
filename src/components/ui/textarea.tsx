'use client';
import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border border-zinc-300 hover:border-zinc-400 bg-white px-3.5 py-2.5 text-base md:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 focus:shadow-none focus:border-zinc-900 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm transition-all duration-200",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

