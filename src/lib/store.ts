"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ResultFilter } from "@/lib/types";

export type ViewId =
  | "dashboard"
  | "search"
  | "results"
  | "projects"
  | "export"
  | "history"
  | "settings";

interface AppState {
  // navigation
  view: ViewId;
  setView: (v: ViewId) => void;

  // results filter (persisted so Results/Export share context)
  filter: ResultFilter;
  setFilter: (f: Partial<ResultFilter>) => void;
  resetFilter: () => void;

  // currently focused project (for Projects → detail)
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // currently focused search history (e.g. "view results of this search")
  activeSearchHistoryId: string | null;
  setActiveSearchHistoryId: (id: string | null) => void;

  // a monotonically increasing counter bumped after data-mutating ops so
  // views can refetch via react-query keys.
  dataVersion: number;
  bumpData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: "dashboard",
      setView: (view) => set({ view }),

      filter: {},
      setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
      resetFilter: () => set({ filter: {} }),

      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),

      activeSearchHistoryId: null,
      setActiveSearchHistoryId: (id) => set({ activeSearchHistoryId: id }),

      dataVersion: 0,
      bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
    }),
    {
      name: "lead-finder-pro",
      partialize: (s) => ({
        view: s.view,
        filter: s.filter,
        activeProjectId: s.activeProjectId,
        activeSearchHistoryId: s.activeSearchHistoryId,
      }),
    },
  ),
);
