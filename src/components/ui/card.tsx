import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl transition-all duration-300",
  {
    variants: {
      variant: {
        default:
          "backdrop-blur-xl bg-white/80 border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-zinc-800",
        elevated:
          "backdrop-blur-2xl bg-white/95 border border-zinc-200 shadow-[0_12px_40px_rgb(0,0,0,0.06)] text-zinc-800",
        interactive:
          "backdrop-blur-xl bg-white/80 border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-amber-400/60 hover:shadow-[0_12px_35px_rgba(245,158,11,0.12)] cursor-pointer text-zinc-800",
        glass:
          "backdrop-blur-xl bg-white/70 border border-zinc-200/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-zinc-800",
        gradient:
          "bg-gradient-to-br from-white via-zinc-50 to-amber-50/30 border border-amber-200/60 shadow-md text-zinc-800",
        glow:
          "bg-white border border-amber-300/80 shadow-[0_0_30px_rgba(245,158,11,0.15)] text-zinc-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-snug tracking-tight text-zinc-800",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-zinc-500 leading-relaxed font-normal", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };