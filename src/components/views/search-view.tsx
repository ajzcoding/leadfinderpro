"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search as SearchIcon,
  Loader2,
  MapPin,
  Tag,
  Type,
  Radius,
  Server,
  Globe,
  FolderKanban,
  Zap,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { runSearch, fetchProjects, fetchSettings } from "@/lib/api-client";
import { CATEGORY_OPTIONS, type ProviderId, type SearchParams } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const PROVIDER_LABELS: Record<string, string> = {
  openstreetmap: "OpenStreetMap (Overpass) — Free, no key",
  geoapify: "Geoapify Places",
  foursquare: "Foursquare Places",
  tomtom: "TomTom Search",
  googlemaps: "Google Maps Places",
};

const PROGRESS_STAGES = [
  { label: "Resolving location coordinates…", pct: 15 },
  { label: "Querying data provider…", pct: 45 },
  { label: "Normalizing & deduplicating results…", pct: 70 },
  { label: "Persisting businesses to local database…", pct: 88 },
  { label: "Finalizing…", pct: 96 },
];

export function SearchView() {
  const setView = useAppStore((s) => s.setView);
  const setActiveSearchHistoryId = useAppStore((s) => s.setActiveSearchHistoryId);
  const setFilter = useAppStore((s) => s.setFilter);
  const bumpData = useAppStore((s) => s.bumpData);

  const [form, setForm] = React.useState<SearchParams>({
    country: "",
    state: "",
    city: "",
    category: "",
    keyword: "",
    radius: 5000,
    provider: "openstreetmap",
    scanWebsites: false,
    projectId: null,
    limit: 60,
  });
  const [progressStage, setProgressStage] = React.useState(0);

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const set = <K extends keyof SearchParams>(k: K, v: SearchParams[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Rotate staged progress messages while search is in flight.
  const stageTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  React.useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (params: SearchParams) => {
      setProgressStage(0);
      stageTimer.current = setInterval(() => {
        setProgressStage((s) => (s < PROGRESS_STAGES.length - 1 ? s + 1 : s));
      }, 2200);
      return runSearch(params);
    },
    onSuccess: (res) => {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setProgressStage(PROGRESS_STAGES.length - 1);
      bumpData();
      setActiveSearchHistoryId(res.searchHistoryId);
      setFilter({ searchHistoryId: res.searchHistoryId });
      toast.success(`Found ${res.totalResults} businesses`, {
        description: res.center?.displayName
          ? `Near ${res.center.displayName}`
          : undefined,
      });
      setTimeout(() => setView("results"), 600);
    },
    onError: (err: Error) => {
      if (stageTimer.current) clearInterval(stageTimer.current);
      toast.error("Search failed", { description: err.message });
    },
  });

  const canSearch = Boolean(form.city || form.state || form.country || form.keyword);

  const availableProviders = React.useMemo(() => {
    const list: { id: ProviderId; label: string; disabled?: boolean }[] = [
      { id: "openstreetmap", label: PROVIDER_LABELS.openstreetmap },
    ];
    const cfg: Record<string, { hasKey: boolean; enabled: boolean; requiresKey: boolean }> = {};
    for (const s of settings ?? []) cfg[s.provider] = { hasKey: s.hasKey, enabled: s.enabled, requiresKey: s.requiresKey };
    for (const p of ["geoapify", "foursquare", "tomtom", "googlemaps"] as ProviderId[]) {
      const c = cfg[p];
      const ready = c && c.enabled && c.hasKey;
      list.push({
        id: p,
        label: PROVIDER_LABELS[p] + (ready ? "" : " (needs API key in Settings)"),
        disabled: !ready,
      });
    }
    return list;
  }, [settings]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5 text-primary" />
            Find Businesses
          </CardTitle>
          <CardDescription>
            Search legal, authorized data sources for local businesses by location and category.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Location */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              Location
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-xs">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g. Germany"
                  value={form.country ?? ""}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state" className="text-xs">State / Region</Label>
                <Input
                  id="state"
                  placeholder="e.g. Berlin"
                  value={form.state ?? ""}
                  onChange={(e) => set("state", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. Berlin"
                  value={form.city ?? ""}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Category + keyword */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4 text-primary" />
              Category & Keyword
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.category ?? "__none"}
                  onValueChange={(v) => set("category", v === "__none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none">Any category</SelectItem>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="keyword" className="text-xs">
                  <Type className="inline h-3 w-3 mr-1" />
                  Keyword (optional)
                </Label>
                <Input
                  id="keyword"
                  placeholder="e.g. pizza, salon, dentist"
                  value={form.keyword ?? ""}
                  onChange={(e) => set("keyword", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Radius */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Radius className="h-4 w-4 text-primary" />
                Search Radius
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {((form.radius ?? 5000) / 1000).toFixed(1)} km
              </Badge>
            </div>
            <Slider
              value={[form.radius ?? 5000]}
              min={500}
              max={25000}
              step={500}
              onValueChange={([v]) => set("radius", v)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0.5 km</span>
              <span>25 km</span>
            </div>
          </div>

          {/* Provider + project */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4 text-primary" />
              Data Source
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select
                  value={form.provider ?? "openstreetmap"}
                  onValueChange={(v) => set("provider", v as ProviderId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.disabled}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  <FolderKanban className="inline h-3 w-3 mr-1" />
                  Save to Project (optional)
                </Label>
                <Select
                  value={form.projectId ?? "__none"}
                  onValueChange={(v) => set("projectId", v === "__none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
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
              </div>
            </div>
          </div>

          {/* Scan toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  Scan websites for contact info
                  <Badge variant="outline" className="text-[10px]">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    slower
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Fetches each business&apos;s public website (respecting robots.txt) to extract
                  emails, phones & social links.
                </p>
              </div>
            </div>
            <Switch
              checked={!!form.scanWebsites}
              onCheckedChange={(v) => set("scanWebsites", v)}
              aria-label="Scan websites"
            />
          </div>

          <Button
            className="w-full gap-2 h-11"
            size="lg"
            disabled={!canSearch || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Search Businesses
              </>
            )}
          </Button>
          {!canSearch && (
            <p className="text-center text-xs text-muted-foreground">
              Enter at least a location or a keyword to search.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress / tips panel */}
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">
            {mutation.isPending ? "Search in progress" : "How it works"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mutation.isPending ? (
            <div className="space-y-4">
              <Progress value={PROGRESS_STAGES[progressStage].pct} className="h-2" />
              <div className="space-y-2.5">
                {PROGRESS_STAGES.map((stage, i) => {
                  const done = i < progressStage;
                  const active = i === progressStage;
                  return (
                    <div key={i} className="flex items-center gap-2.5 text-sm">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : active ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                      )}
                      <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {form.scanWebsites && (
                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Website scanning is enabled — this search will take longer as each site is
                  fetched & parsed.
                </div>
              )}
            </div>
          ) : mutation.isSuccess ? (
            <div className="space-y-3 text-center py-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium">Search complete</p>
              <Button className="gap-2" onClick={() => setView("results")}>
                View Results
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <ol className="space-y-3 text-sm text-muted-foreground">
              <Step n={1} title="Enter a location">
                City, state, or country — resolved to coordinates via Nominatim (free).
              </Step>
              <Step n={2} title="Pick a category">
                Maps to provider-specific business categories (e.g. OSM amenity tags).
              </Step>
              <Step n={3} title="Choose a data source">
                OpenStreetMap works out of the box. Add API keys in Settings to enable
                Geoapify, Foursquare, or TomTom.
              </Step>
              <Step n={4} title="Optionally scan websites">
                Extracts public emails, phones & social links from each business site.
              </Step>
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs">{children}</p>
      </div>
    </li>
  );
}
