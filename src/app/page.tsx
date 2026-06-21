"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/store";
import { DashboardView } from "@/components/views/dashboard-view";
import { SearchView } from "@/components/views/search-view";
import { ResultsView } from "@/components/views/results-view";
import { ProjectsView } from "@/components/views/projects-view";
import { ExportView } from "@/components/views/export-view";
import { HistoryView } from "@/components/views/history-view";
import { SettingsView } from "@/components/views/settings-view";

export default function Home() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  // Guard against a persisted but unknown view id.
  React.useEffect(() => {
    const valid = ["dashboard", "search", "results", "projects", "export", "history", "settings"];
    if (!valid.includes(view)) setView("dashboard");
  }, [view, setView]);

  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "search" && <SearchView />}
      {view === "results" && <ResultsView />}
      {view === "projects" && <ProjectsView />}
      {view === "export" && <ExportView />}
      {view === "history" && <HistoryView />}
      {view === "settings" && <SettingsView />}
    </AppShell>
  );
}
