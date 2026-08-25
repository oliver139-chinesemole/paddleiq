import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, id, ...props }, ref) => {
    // Same as Input: the visible label was never tied to the control.
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[#94A3B8]">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-11 w-full rounded-xl border border-[#1E293B] bg-[#111827] px-4 text-[#F1F5F9] text-sm outline-none transition-colors appearance-none cursor-pointer",
          "focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#EF4444]",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0D1528]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p id={errorId} className="text-xs text-[#EF4444]">{error}</p>}
    </div>
    );
  }
);
Select.displayName = "Select";
