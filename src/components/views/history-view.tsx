"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History as HistoryIcon,
  Trash2,
  Eye,
  MapPin,
  Tag,
  Server,
  Calendar,
  Loader2,
  Inbox,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHistory, deleteHistory } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { format } from "date-fns";

export function HistoryView() {
  const qc = useQueryClient();
  const dataVersion = useAppStore((s) => s.dataVersion);
  const setFilter = useAppStore((s) => s.setFilter);
  const setActiveSearchHistoryId = useAppStore((s) => s.setActiveSearchHistoryId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const setView = useAppStore((s) => s.setView);

  const { data, isLoading } = useQuery({
    queryKey: ["history", dataVersion],
    queryFn: fetchHistory,
  });

  const deleteMut = useMutation({
    mutationFn: (id?: string) => deleteHistory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("Search history cleared");
    },
  });

  const viewResults = (id: string) => {
    setActiveProjectId(null);
    setActiveSearchHistoryId(id);
    setFilter({ searchHistoryId: id, projectId: null });
    setView("results");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Search History</h2>
          <p className="text-sm text-muted-foreground">
            Every search is automatically logged with its keyword, location, and result count.
          </p>
        </div>
        {data && data.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5"
            disabled={deleteMut.isPending}
            onClick={() => {
              if (confirm("Clear ALL search history? Businesses will be kept but unlinked from their searches.")) {
                deleteMut.mutate();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-primary" />
            Past Searches
            {data && <Badge variant="secondary" className="tabular-nums">{data.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No search history yet</p>
                <p className="text-sm text-muted-foreground">
                  Run your first search to start building history.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Search</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Results</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[140px]">
                            {h.keyword || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {h.category ? (
                          <Badge variant="outline" className="font-normal">{h.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[h.city, h.state, h.country].filter(Boolean).join(", ") || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Server className="h-3 w-3" />
                          {h.provider ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums">{h.totalResults}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(h.date), "MMM d, yyyy")}
                          <span className="hidden sm:inline">· {format(new Date(h.date), "HH:mm")}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => viewResults(h.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                            onClick={() => {
                              if (confirm("Delete this search history entry?")) deleteMut.mutate(h.id);
                            }}
                            aria-label="Delete entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
  );
}
