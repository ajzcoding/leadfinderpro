"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Braces,
  Globe,
  Mail,
  Phone,
  FolderKanban,
  History as HistoryIcon,
  Loader2,
  CheckCircle2,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchBusinesses,
  fetchExportHistory,
  fetchProjects,
  buildExportUrl,
} from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";
import type { ResultFilter } from "@/lib/types";

type Format = "csv" | "xlsx" | "json";

const FORMAT_META: { id: Format; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; accent: string }[] = [
  {
    id: "csv",
    label: "CSV",
    desc: "Universal spreadsheet format. Opens in Excel, Google Sheets, Numbers.",
    icon: FileText,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "xlsx",
    label: "Excel (.xlsx)",
    desc: "Native Excel workbook with formatted columns and auto-width.",
    icon: FileSpreadsheet,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    id: "json",
    label: "JSON",
    desc: "Structured data for developers & API integrations.",
    icon: Braces,
    accent: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
];

export function ExportView() {
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveSearchHistoryId = useAppStore((s) => s.setActiveSearchHistoryId);
  const dataVersion = useAppStore((s) => s.dataVersion);

  const [format, setFormat] = React.useState<Format>("csv");

  // Preview the count that would be exported with the current filter.
  const previewQ = useQuery({
    queryKey: ["export-preview", filter],
    queryFn: () => fetchBusinesses({ ...filter, page: 1, pageSize: 1 }),
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const historyQ = useQuery({
    queryKey: ["export-history", dataVersion],
    queryFn: fetchExportHistory,
  });

  const previewCount = previewQ.data?.total ?? 0;

  const doExport = () => {
    const url = buildExportUrl(format, filter);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Exporting ${previewCount} leads as ${format.toUpperCase()}`, {
      description: "Check your downloads folder.",
    });
  };

  const activeScope =
    filter.projectId || filter.searchHistoryId
      ? projects?.find((p) => p.id === filter.projectId)?.name ?? "Filtered set"
      : "All leads";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Export Leads</h2>
        <p className="text-sm text-muted-foreground">
          Download your lead data in CSV, Excel, or JSON format. Exports are logged below.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* Format + filters */}
        <div className="space-y-4">
          {/* Format selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                Choose Format
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {FORMAT_META.map((f) => {
                const Icon = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-lg border-2 p-4 text-left transition-all hover:border-primary/40 ${active ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-sm font-semibold">{f.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                    {active && (
                      <CheckCircle2 className="mt-2 h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Filter scope */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Export Scope
              </CardTitle>
              <CardDescription>
                Filters applied here determine which leads are included in the export.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active context */}
              {(filter.projectId || filter.searchHistoryId) && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <span>Scoped to:</span>
                  <Badge variant="secondary">
                    {filter.projectId
                      ? projects?.find((p) => p.id === filter.projectId)?.name ?? "Project"
                      : "Search results"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7"
                    onClick={() => {
                      resetFilter();
                      setActiveProjectId(null);
                      setActiveSearchHistoryId(null);
                    }}
                  >
                    Clear scope
                  </Button>
                </div>
              )}

              {/* Quick toggles */}
              <div className="grid gap-3 sm:grid-cols-3">
                <ToggleRow
                  icon={Globe}
                  label="Has website"
                  checked={filter.websiteAvailable === true}
                  onChange={(v) => setFilter({ websiteAvailable: v ? true : null })}
                />
                <ToggleRow
                  icon={Mail}
                  label="Has email"
                  checked={filter.emailAvailable === true}
                  onChange={(v) => setFilter({ emailAvailable: v ? true : null })}
                />
                <ToggleRow
                  icon={Phone}
                  label="Has phone"
                  checked={filter.phoneAvailable === true}
                  onChange={(v) => setFilter({ phoneAvailable: v ? true : null })}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
                <span className="text-sm">
                  Estimated leads:{" "}
                  <Badge variant="secondary" className="tabular-nums">
                    {previewQ.isLoading ? "…" : previewCount}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">{activeScope}</span>
              </div>

              <Button
                className="w-full gap-2 h-11"
                size="lg"
                disabled={previewCount === 0}
                onClick={doExport}
              >
                <Download className="h-4 w-4" />
                Export {previewCount} leads as {format.toUpperCase()}
              </Button>
              {previewCount === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  No leads match the current scope. Adjust filters or run a search first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Export history */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-primary" />
              Export History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyQ.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !historyQ.data?.length ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No exports yet. Your exports will appear here.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto scroll-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Format</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQ.data.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">{h.format}</Badge>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground max-w-[160px]">
                            {h.filename}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{h.count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(h.date), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/30">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
