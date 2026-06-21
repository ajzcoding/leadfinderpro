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

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, { bg: string; ring: string }> = {
  default: {
    bg: "bg-primary/10 text-primary",
    ring: "ring-primary/20",
  },
  success: {
    bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/25",
  },
  warning: {
    bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/25",
  },
  danger: {
    bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/25",
  },
};

export function StatCard({ label, value, icon: Icon, hint, accent = "default" }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <Card className="overflow-hidden hover-lift group">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform group-hover:scale-105",
            a.bg,
            a.ring,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</p>
          {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
