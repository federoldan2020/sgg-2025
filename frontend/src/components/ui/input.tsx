import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base premium
        "w-full min-w-0 rounded-md border bg-background text-sm text-foreground",
        "h-10 px-3 py-2",
        "placeholder:text-muted-foreground",
        "shadow-sm",
        "transition-colors transition-shadow",
        "outline-none",

        // File input
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",

        // Focus
        "focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20",

        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/30",

        // Dark subtle input background
        "dark:bg-input/30",

        // Invalid (aria-invalid)
        "aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/30",

        className
      )}
      {...props}
    />
  );
}

export { Input };
