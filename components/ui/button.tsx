"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#0EA5E9] text-white hover:bg-[#0284C7] shadow-lg shadow-[#0EA5E9]/20",
        secondary: "bg-[#1E293B] text-[#F1F5F9] hover:bg-[#334155]",
        outline: "border border-[#1E293B] text-[#F1F5F9] hover:bg-[#1E293B]",
        ghost: "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B]",
        destructive: "bg-[#EF4444] text-white hover:bg-[#DC2626]",
        success: "bg-[#10B981] text-white hover:bg-[#059669]",
        orange: "bg-[#F97316] text-white hover:bg-[#EA580C]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        xl: "h-15 px-8 text-lg",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };
