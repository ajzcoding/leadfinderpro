"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Globe,
  Ban,
  Mail,
  Phone,
  FolderKanban,
  History as HistoryIcon,
  ArrowRight,
  MapPin,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import { fetchDashboard } from "@/lib/api-client";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardView() {
  const setView = useAppStore((s) => s.setView);
  const setActiveSearchHistoryId = useAppStore((s) => s.setActiveSearchHistoryId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", dataVersion],
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-emerald-500/5 to-transparent" />
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
        <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Personal Edition
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome to Lead Finder Pro
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Discover local businesses from legal, authorized data sources, scan their
              websites for public contact info, and export clean lead lists. No sign-up —
              launches straight to your dashboard.
            </p>
          </div>
          <Button className="gap-2 shrink-0 shadow-sm" size="lg" onClick={() => setView("search")}>
            <SearchIcon className="h-4 w-4" />
            Start a Search
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-11 w-11 rounded-lg" />
                <Skeleton className="mt-3 h-3 w-20" />
                <Skeleton className="mt-2 h-7 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Total Businesses" value={data.totalBusinesses} icon={Building2} accent="default" />
            <StatCard label="Websites Found" value={data.websitesFound} icon={Globe} accent="success" />
            <StatCard label="No Website" value={data.websitesNotFound} icon={Ban} accent="warning" />
            <StatCard label="Emails Found" value={data.emailsFound} icon={Mail} accent="success" />
            <StatCard label="Phone Numbers" value={data.phonesFound} icon={Phone} accent="default" />
            <StatCard label="Saved Projects" value={data.savedProjects} icon={FolderKanban} accent="default" />
          </>
        )}
      </div>

      {/* Recent searches + projects */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HistoryIcon className="h-4 w-4 text-primary" />
              Recent Searches
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setView("history")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading || !data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : data.recentSearchList.length === 0 ? (
              <EmptyHint
                icon={HistoryIcon}
                text="No searches yet. Run your first search to populate this list."
                actionLabel="Search"
                onAction={() => setView("search")}
              />
            ) : (
              <ul className="divide-y">
                {data.recentSearchList.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setActiveSearchHistoryId(s.id);
                        setView("results");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.keyword || s.category || "Untitled search"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[s.city, s.state, s.country].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="tabular-nums">
                          {s.totalResults}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(s.date), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4 text-primary" />
              Recent Projects
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setView("projects")}>
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading || !data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : data.recentProjects.length === 0 ? (
              <EmptyHint
                icon={FolderKanban}
                text="No projects yet. Create one to organize your saved leads."
                actionLabel="New Project"
                onAction={() => setView("projects")}
              />
            ) : (
              <ul className="divide-y">
                {data.recentProjects.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setActiveProjectId(p.id);
                        setView("projects");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.description || "No description"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="tabular-nums">
                          {p.businessCount} leads
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      <Button variant="outline" size="sm" onClick={onAction} className="gap-2">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// re-export for lazy loaders
export const DashboardLoading = () => (
  <div className="flex items-center justify-center py-20 text-muted-foreground">
    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
    Loading dashboard…
  </div>
);
