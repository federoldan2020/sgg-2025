"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsCtx(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`${component} must be used inside <Tabs>`);
  return ctx;
}

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
  const current = isControlled ? value : internal;

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-start gap-1 rounded-lg bg-neutral-100 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const ctx = useTabsCtx("TabsTrigger");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all",
        "ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500/50 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-600 hover:text-neutral-900",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = useTabsCtx("TabsContent");
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      data-state="active"
      className={cn("focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
