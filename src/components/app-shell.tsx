"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Search,
  Table2,
  FolderKanban,
  Download,
  History,
  Settings,
  Crosshair,
  Menu,
  Github,
} from "lucide-react";
import { useAppStore, type ViewId } from "@/lib/store";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview & stats" },
  { id: "search", label: "Search", icon: Search, description: "Find businesses" },
  { id: "results", label: "Results", icon: Table2, description: "Browse & filter leads" },
  { id: "projects", label: "Projects", icon: FolderKanban, description: "Saved collections" },
  { id: "export", label: "Export", icon: Download, description: "CSV / Excel / JSON" },
  { id: "history", label: "Search History", icon: History, description: "Past searches" },
  { id: "settings", label: "Settings", icon: Settings, description: "API keys & providers" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => {
              setView(item.id);
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Crosshair className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight">Lead Finder Pro</span>
        <span className="text-[10px] text-muted-foreground">Personal Edition</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const view = useAppStore((s) => s.view);
  const current = NAV.find((n) => n.id === view);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-sidebar p-4 sticky top-0 h-screen">
          <SidebarBrand />
          <div className="mt-6 flex-1">
            <NavList />
          </div>
          <div className="mt-auto flex items-center justify-between rounded-lg border bg-card px-3 py-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-medium">Theme</span>
              <span className="text-[10px] text-muted-foreground">Light / Dark</span>
            </div>
            <ModeToggle />
          </div>
        </aside>

        {/* Mobile sidebar (drawer) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-4 bg-sidebar">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBrand />
            <div className="mt-6">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-6 flex items-center justify-between rounded-lg border bg-card px-3 py-2.5">
              <span className="text-xs font-medium">Theme</span>
              <ModeToggle />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
            {/* Mobile menu trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-9 w-9"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="flex flex-col">
              <h1 className="text-base font-semibold leading-none">
                {current?.label ?? "Dashboard"}
              </h1>
              <span className="hidden sm:block text-xs text-muted-foreground">
                {current?.description}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <Github className="h-3.5 w-3.5" />
                  OSM Data
                </Button>
              </Link>
              <div className="lg:hidden">
                <ModeToggle />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 lg:p-6">{children}</main>

          {/* Footer (sticky bottom) */}
          <footer className="mt-auto border-t bg-card px-4 py-3 lg:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
              <span>
                Lead Finder Pro · Personal-use · Data ©{" "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  OpenStreetMap
                </a>{" "}
                contributors
              </span>
              <span>Use only legal, authorized data sources. Respect robots.txt & ToS.</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
