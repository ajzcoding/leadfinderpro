"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  accent?: "default" | "success" | "warning" | "danger";
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

export function StatCard({ label, value, icon: Icon, hint, accent = "default" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", ACCENTS[accent])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums leading-none">{value}</p>
          {hint && <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
