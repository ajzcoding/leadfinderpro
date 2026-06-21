"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Mail,
  Phone,
  Search as SearchIcon,
  Filter,
  Download,
  FileText,
  FileSpreadsheet,
  Braces,
  ExternalLink,
  X,
  Inbox,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  History,
} from "lucide-react";
import { fetchBusinesses, fetchProject, fetchHistory, buildExportUrl } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { CATEGORY_OPTIONS, type BusinessRecord } from "@/lib/types";
import { BusinessDetailDialog } from "@/components/business-detail-dialog";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export function ResultsView() {
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setActiveSearchHistoryId = useAppStore((s) => s.setActiveSearchHistoryId);
  const setView = useAppStore((s) => s.setView);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<BusinessRecord | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  React.useEffect(() => setPage(1), [
    filter.websiteAvailable,
    filter.emailAvailable,
    filter.phoneAvailable,
    filter.category,
    filter.city,
    filter.state,
    filter.search,
    filter.projectId,
    filter.searchHistoryId,
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["businesses", filter, page, PAGE_SIZE],
    queryFn: () => fetchBusinesses({ ...filter, page, pageSize: PAGE_SIZE }),
  });

  // Resolve the "active context" (project or search history name) for the header.
  const projectQ = useQuery({
    queryKey: ["project", filter.projectId],
    queryFn: () => fetchProject(filter.projectId!),
    enabled: !!filter.projectId,
  });
  const historyQ = useQuery({
    queryKey: ["history-list"],
    queryFn: fetchHistory,
    enabled: !!filter.searchHistoryId,
  });
  const activeSearch = historyQ.data?.find((h) => h.id === filter.searchHistoryId);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeFilterCount = [
    filter.websiteAvailable != null,
    filter.emailAvailable != null,
    filter.phoneAvailable != null,
    filter.category,
    filter.city,
    filter.state,
    filter.search,
  ].filter(Boolean).length;

  const handleExport = (format: "csv" | "xlsx" | "json") => {
    const url = buildExportUrl(format, filter);
    // Trigger download in a new tab; the API streams the file.
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Exporting ${format.toUpperCase()}`, {
      description: `${total} businesses included`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Context banner */}
      {(filter.projectId || filter.searchHistoryId) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Showing results for:</span>
            {filter.projectId && (
              <Badge variant="secondary" className="gap-1">
                <FolderKanban className="h-3 w-3" />
                {projectQ.data?.name ?? "Project"}
                <button
                  onClick={() => {
                    setFilter({ projectId: null });
                    setActiveProjectId(null);
                  }}
                  className="ml-1 rounded-full hover:bg-background/50"
                  aria-label="Remove project filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filter.searchHistoryId && (
              <Badge variant="secondary" className="gap-1">
                <History className="h-3 w-3" />
                {activeSearch
                  ? `${activeSearch.keyword || activeSearch.category || "Search"} — ${activeSearch.city ?? ""}`
                  : "Search"}
                <button
                  onClick={() => {
                    setFilter({ searchHistoryId: null });
                    setActiveSearchHistoryId(null);
                  }}
                  className="ml-1 rounded-full hover:bg-background/50"
                  aria-label="Remove search filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                resetFilter();
                setActiveProjectId(null);
                setActiveSearchHistoryId(null);
              }}
            >
              Clear context
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters + export */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Export:</span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("csv")} disabled={total === 0}>
                <FileText className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("xlsx")} disabled={total === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("json")} disabled={total === 0}>
                <Braces className="h-3.5 w-3.5" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <label className="text-xs text-muted-foreground">Search by name / address / email</label>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search leads…"
                  className="pl-8"
                  value={filter.search ?? ""}
                  onChange={(e) => setFilter({ search: e.target.value || null })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Website</label>
              <Select
                value={filter.websiteAvailable == null ? "any" : filter.websiteAvailable ? "yes" : "no"}
                onValueChange={(v) =>
                  setFilter({ websiteAvailable: v === "any" ? null : v === "yes" })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has website</SelectItem>
                  <SelectItem value="no">No website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={filter.category ?? "__any"}
                onValueChange={(v) => setFilter({ category: v === "__any" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__any">Any</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Email</label>
              <Select
                value={filter.emailAvailable == null ? "any" : filter.emailAvailable ? "yes" : "no"}
                onValueChange={(v) =>
                  setFilter({ emailAvailable: v === "any" ? null : v === "yes" })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has email</SelectItem>
                  <SelectItem value="no">No email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Select
                value={filter.phoneAvailable == null ? "any" : filter.phoneAvailable ? "yes" : "no"}
                onValueChange={(v) =>
                  setFilter({ phoneAvailable: v === "any" ? null : v === "yes" })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has phone</SelectItem>
                  <SelectItem value="no">No phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">City</label>
              <Input
                placeholder="Any"
                value={filter.city ?? ""}
                onChange={(e) => setFilter({ city: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">State</label>
              <Input
                placeholder="Any"
                value={filter.state ?? ""}
                onChange={(e) => setFilter({ state: e.target.value || null })}
              />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetFilter();
                  setActiveProjectId(null);
                  setActiveSearchHistoryId(null);
                }}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Clear all filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Leads{" "}
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {total}
              </Badge>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No leads found</p>
                <p className="text-sm text-muted-foreground">
                  Run a search or adjust your filters to see results.
                </p>
              </div>
              <Button className="gap-2" onClick={() => setView("search")}>
                <SearchIcon className="h-4 w-4" />
                Start a search
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto scroll-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Business</TableHead>
                      <TableHead className="min-w-[120px]">Category</TableHead>
                      <TableHead className="min-w-[120px]">Location</TableHead>
                      <TableHead className="min-w-[90px]">Website</TableHead>
                      <TableHead className="min-w-[160px]">Email</TableHead>
                      <TableHead className="min-w-[130px]">Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.businesses.map((b) => (
                      <TableRow
                        key={b.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelected(b);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell>
                          <div className="font-medium truncate max-w-[200px]">{b.name}</div>
                          <div className="text-[11px] text-muted-foreground">{b.dataSource}</div>
                        </TableCell>
                        <TableCell>
                          {b.category ? (
                            <Badge variant="outline" className="font-normal">{b.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <WebsiteBadge status={b.websiteStatus} url={b.website} />
                        </TableCell>
                        <TableCell>
                          {b.email ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Mail className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate max-w-[140px]">{b.email}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {b.phone ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[110px]">{b.phone}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BusinessDetailDialog
        business={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

function WebsiteBadge({ status, url }: { status: string; url: string | null }) {
  if (!url) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const style =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : status === "inactive"
        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
        : "bg-muted text-muted-foreground";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex"
    >
      <Badge className={`gap-1 ${style}`} variant="outline">
        <Globe className="h-3 w-3" />
        {status}
        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
      </Badge>
    </a>
  );
}
