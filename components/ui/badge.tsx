import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#0EA5E9]/20 text-[#0EA5E9]",
        secondary: "bg-[#1E293B] text-[#94A3B8]",
        success: "bg-[#10B981]/20 text-[#10B981]",
        warning: "bg-[#F59E0B]/20 text-[#F59E0B]",
        // Lightened from #EF4444, which gave 3.97:1 against its own 20% tint
        // over the page background — under the 4.5:1 AA minimum, and these
        // badges are rendered at 10px in places. #FCA5A5 measures 7.87:1 and
        // still reads as the warning colour. Every other variant already
        // passed; this was the only one.
        destructive: "bg-[#EF4444]/20 text-[#FCA5A5]",
        outline: "border border-[#1E293B] text-[#94A3B8]",
        orange: "bg-[#F97316]/20 text-[#F97316]",
        cyan: "bg-[#06B6D4]/20 text-[#06B6D4]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
