"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  Globe,
  Mail,
  Phone,
  Inbox,
  Download,
  ExternalLink,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  buildExportUrl,
} from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function ProjectsView() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  if (activeProjectId) {
    return <ProjectDetail id={activeProjectId} onBack={() => setActiveProjectId(null)} />;
  }
  return <ProjectList onOpen={(id) => setActiveProjectId(id)} />;
}

function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<{ id: string; name: string; description: string | null; color: string | null } | null>(null);

  const createMut = useMutation({
    mutationFn: (d: { name: string; description?: string; color?: string }) => createProject(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error("Create failed", { description: e.message }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
  });
  const updateMut = useMutation({
    mutationFn: (d: { id: string; name?: string; description?: string; color?: string }) =>
      updateProject(d.id, { name: d.name, description: d.description, color: d.color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project updated");
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-muted-foreground">Organize saved leads into collections.</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create a project to group leads by campaign, city, or industry.
              </p>
            </div>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="group relative overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full w-1"
                style={{ backgroundColor: p.color ?? "#10b981" }}
              />
              <CardHeader className="pb-2 pl-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="h-4 w-4" style={{ color: p.color ?? "#10b981" }} />
                  {p.name}
                </CardTitle>
                <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                  {p.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {p.businessCount} leads
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => onOpen(p.id)}>
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditTarget({ id: p.id, name: p.name, description: p.description, color: p.color })}
                    aria-label="Rename project"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"? Leads will be unlinked, not deleted.`)) {
                        deleteMut.mutate(p.id);
                      }
                    }}
                    aria-label="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Project"
        onSubmit={(d) => createMut.mutate(d)}
        pending={createMut.isPending}
      />
      <ProjectFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        title="Rename Project"
        initial={editTarget ?? undefined}
        onSubmit={(d) => {
          if (!editTarget) return;
          updateMut.mutate({ id: editTarget.id, ...d });
        }}
        pending={updateMut.isPending}
      />
    </div>
  );
}

function ProjectDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const setFilter = useAppStore((s) => s.setFilter);
  const setView = useAppStore((s) => s.setView);
  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
  });

  const handleExport = (format: "csv" | "xlsx" | "json") => {
    const url = buildExportUrl(format, { projectId: id });
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Exporting ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="truncate text-lg font-semibold">{data?.name ?? "Project"}</h2>
          {data?.description && (
            <p className="truncate text-sm text-muted-foreground">{data.description}</p>
          )}
        </div>
        {data && data.businesses.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExport("xlsx")}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Leads in this project
            {data && <Badge variant="secondary" className="tabular-nums">{data.businesses.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.businesses.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No leads in this project</p>
                <p className="text-sm text-muted-foreground">
                  Run a search and save results to this project, or assign leads from the Results page.
                </p>
              </div>
              <Button className="gap-2" onClick={() => setView("search")}>
                <Plus className="h-4 w-4" />
                Add leads
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Business</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.businesses.map((b) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilter({ search: b.name });
                        setView("results");
                      }}
                    >
                      <TableCell className="font-medium truncate max-w-[200px]">{b.name}</TableCell>
                      <TableCell>
                        {b.category ? <Badge variant="outline">{b.category}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        {b.website ? (
                          <a href={b.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" /> {b.websiteStatus}
                              <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                            </Badge>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {b.email && <Mail className="h-3.5 w-3.5 text-emerald-500" />}
                          {b.phone && <Phone className="h-3.5 w-3.5 text-primary" />}
                          {!b.email && !b.phone && <span className="text-muted-foreground text-xs">—</span>}
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

function ProjectFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial?: { name: string; description: string | null; color: string | null };
  onSubmit: (d: { name: string; description?: string; color?: string }) => void;
  pending?: boolean;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [color, setColor] = React.useState(initial?.color ?? COLORS[0]);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setColor(initial?.color ?? COLORS[0]);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Projects help you group leads by campaign or source.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Berlin Restaurants Q1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdesc">Description (optional)</Label>
            <Textarea id="pdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this collection for?" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "scale-110 border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || pending}
            onClick={() => onSubmit({ name: name.trim(), description: description.trim() || undefined, color })}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
