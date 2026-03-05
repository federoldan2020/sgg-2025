import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 transition-colors",
        "placeholder:text-neutral-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        "border-neutral-300 hover:border-neutral-400",
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "aria-invalid:border-red-500 aria-invalid:text-red-900 aria-invalid:focus-visible:ring-red-500",
        className
      )}
      {...props}
    />
  );
}

export { Input };
