"use client";

import * as React from "react";
import {
  Globe,
  Mail,
  Phone,
  MapPin,
  Tag,
  Database,
  Clock,
  ExternalLink,
  RefreshCw,
  Trash2,
  FolderPlus,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  rescanBusiness,
  deleteBusiness,
  updateBusiness,
  fetchProjects,
} from "@/lib/api-client";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import type { BusinessRecord, SocialLinks } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  inactive: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  none: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

function SocialRow({ socials }: { socials: SocialLinks }) {
  const items: { key: keyof SocialLinks; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { key: "facebook", icon: Facebook, label: "Facebook" },
    { key: "twitter", icon: Twitter, label: "Twitter / X" },
    { key: "instagram", icon: Instagram, label: "Instagram" },
    { key: "linkedin", icon: Linkedin, label: "LinkedIn" },
    { key: "youtube", icon: Youtube, label: "YouTube" },
  ];
  const present = items.filter((i) => socials[i.key]);
  if (!present.length && !socials.website) {
    return <p className="text-sm text-muted-foreground">No social links found.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {present.map((i) => {
        const Icon = i.icon;
        const url = socials[i.key] as string;
        return (
          <a key={i.key} href={url} target="_blank" rel="noreferrer">
            <Badge variant="outline" className="gap-1.5 py-1.5 cursor-pointer hover:bg-muted">
              <Icon className="h-3.5 w-3.5" />
              {i.label}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </Badge>
          </a>
        );
      })}
    </div>
  );
}

export function BusinessDetailDialog({
  business,
  open,
  onOpenChange,
}: {
  business: BusinessRecord | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const bumpData = useAppStore((s) => s.bumpData);
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const [projectPick, setProjectPick] = React.useState<string>("__none");

  React.useEffect(() => {
    if (business) setProjectPick(business.projectId ?? "__none");
  }, [business]);

  const rescanMut = useMutation({
    mutationFn: (id: string) => rescanBusiness(id),
    onSuccess: () => {
      toast.success("Website re-scanned");
      bumpData();
    },
    onError: (e: Error) => toast.error("Scan failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBusiness(id),
    onSuccess: () => {
      toast.success("Business deleted");
      bumpData();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  const assignMut = useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId: string | null }) =>
      updateBusiness(id, { projectId }),
    onSuccess: () => {
      toast.success("Saved to project");
      bumpData();
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  if (!business) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <DialogTitle className="text-xl pr-8">{business.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            {business.category && (
              <Badge variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {business.category}
              </Badge>
            )}
            <Badge variant="outline">via {business.dataSource}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field icon={Globe} label="Website" value={business.website}>
              {business.website ? (
                <div className="flex items-center gap-2">
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2 truncate hover:opacity-80"
                  >
                    {business.website}
                  </a>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </div>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
              <Badge className={`mt-1 ${STATUS_STYLE[business.websiteStatus] ?? ""}`}>
                {business.websiteStatus}
              </Badge>
            </Field>

            <Field icon={Mail} label="Email" value={business.email}>
              {business.email ? (
                <a href={`mailto:${business.email}`} className="text-primary underline underline-offset-2 break-all">
                  {business.email}
                </a>
              ) : (
                <span className="text-muted-foreground">Not found</span>
              )}
            </Field>

            <Field icon={Phone} label="Phone" value={business.phone}>
              {business.phone ? (
                <a href={`tel:${business.phone}`} className="text-primary underline underline-offset-2">
                  {business.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">Not found</span>
              )}
            </Field>

            <Field icon={MapPin} label="Location" value={business.address ?? undefined}>
              <p className="text-sm">
                {[business.address, business.city, business.state, business.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              {business.lat != null && business.lng != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${business.lat}&mlon=${business.lng}#map=17/${business.lat}/${business.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary underline underline-offset-2"
                >
                  {business.lat.toFixed(4)}, {business.lng.toFixed(4)} → view on map
                </a>
              )}
            </Field>
          </div>

          <Separator />

          {/* Socials */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Social Media
            </p>
            <SocialRow socials={business.socialLinks} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Source: {business.dataSource}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Updated {new Date(business.lastUpdated).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
          <div className="flex items-center gap-2">
            <Label htmlFor="proj" className="text-xs shrink-0">
              <FolderPlus className="inline h-3.5 w-3.5 mr-1" />
              Assign to:
            </Label>
            <Select value={projectPick} onValueChange={setProjectPick}>
              <SelectTrigger id="proj" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No project</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={assignMut.isPending || projectPick === (business.projectId ?? "__none")}
              onClick={() =>
                assignMut.mutate({
                  id: business.id,
                  projectId: projectPick === "__none" ? null : projectPick,
                })
              }
            >
              {assignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <div className="flex gap-2">
            {business.website && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 flex-1"
                disabled={rescanMut.isPending}
                onClick={() => rescanMut.mutate(business.id)}
              >
                <RefreshCw className={rescanMut.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {rescanMut.isPending ? "Scanning…" : "Re-scan Website"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 flex-1 text-destructive hover:text-destructive hover:bg-destructive/5"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (confirm(`Delete "${business.name}"? This cannot be undone.`)) {
                  deleteMut.mutate(business.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}
