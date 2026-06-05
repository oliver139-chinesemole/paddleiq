import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#94A3B8]">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[100px] rounded-xl border border-[#1E293B] bg-[#111827] px-4 py-3 text-[#F1F5F9] text-sm placeholder:text-[#475569] outline-none transition-colors resize-none",
          "focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#EF4444]",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
);
Textarea.displayName = "Textarea";
