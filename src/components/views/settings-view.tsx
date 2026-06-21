"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Key,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Zap,
  ShieldCheck,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSettings,
  saveProviderConfig,
  deleteProviderConfig,
  toggleProvider,
  testProvider,
  type ProviderSetting,
} from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import type { ProviderId } from "@/lib/types";

export function SettingsView() {
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  return (
    <div className="space-y-6">
      {/* Intro */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Provider Settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage API keys for data providers here — no source-code edits or rebuilds required.
              Keys are stored in your local SQLite database and never sent to any server except the
              provider they belong to. Free providers (OpenStreetMap, Nominatim) need no key.
            </p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((p) => (
            <ProviderCard key={p.provider} provider={p} />
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Legal & authorized sources only.</strong>{" "}
              Lead Finder Pro uses OpenStreetMap (ODbL), Nominatim, Geoapify, Foursquare, and TomTom
              — all of which provide public APIs with their own terms.
            </p>
            <p>
              Website scanning respects each site&apos;s <code className="rounded bg-muted px-1 py-0.5 text-xs">robots.txt</code>{" "}
              and fetches only publicly accessible pages. Always review a provider&apos;s usage policy
              before enabling it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderSetting }) {
  const qc = useQueryClient();
  const bumpData = useAppStore((s) => s.bumpData);
  const [keyInput, setKeyInput] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  const isFree = !provider.requiresKey;

  const saveMut = useMutation({
    mutationFn: () => saveProviderConfig(provider.provider, keyInput, provider.enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      bumpData();
      toast.success(`${provider.name} key saved`);
      setKeyInput("");
      setEditing(false);
      setShowKey(false);
    },
    onError: (e: Error) => toast.error("Save failed", { description: e.message }),
  });

  const testMut = useMutation({
    mutationFn: () => testProvider(provider.provider, keyInput || undefined),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      if (res.ok) toast.success(`${provider.name}: ${res.message}`);
      else toast.error(`${provider.name} test failed`, { description: res.message });
    },
    onError: (e: Error) => toast.error("Test failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteProviderConfig(provider.provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success(`${provider.name} key removed`);
      setKeyInput("");
      setEditing(false);
    },
  });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => toggleProvider(provider.provider, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <Card className={provider.enabled ? "" : "opacity-70"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isFree ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
              {isFree ? <Zap className="h-5 w-5" /> : <Key className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {provider.name}
                {isFree && <Badge variant="secondary" className="text-[10px]">Free · No key</Badge>}
                {provider.hasKey && <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 gap-1 text-[10px]"><Key className="h-2.5 w-2.5" />Key set</Badge>}
              </CardTitle>
              <CardDescription className="mt-1 text-xs leading-relaxed">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={provider.enabled}
            onCheckedChange={(v) => toggleMut.mutate(v)}
            aria-label={`Enable ${provider.name}`}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isFree ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            This provider is free and requires no API key. Use the test button to verify
            connectivity.
          </div>
        ) : provider.hasKey && !editing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
              <code className="text-xs font-mono">{provider.apiKeyMasked}</code>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Replace
              </Button>
            </div>
            {provider.lastTested && (
              <TestResult provider={provider} />
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`key-${provider.provider}`} className="text-xs">
              API Key
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id={`key-${provider.provider}`}
                  type={showKey ? "text" : "password"}
                  placeholder="Paste your API key…"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="pr-9 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                disabled={!keyInput.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Get a key from the{" "}
              <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 inline-flex items-center gap-0.5">
                provider docs <ExternalLink className="h-2.5 w-2.5" />
              </a>
              .
            </p>
            {editing && provider.lastTested && <TestResult provider={provider} />}
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setKeyInput(""); }}>
                Cancel
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={testMut.isPending || (!isFree && !provider.hasKey && !keyInput)}
            onClick={() => testMut.mutate()}
          >
            {testMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
            Test Connection
          </Button>
          {provider.hasKey && !isFree && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (confirm(`Remove the API key for ${provider.name}?`)) deleteMut.mutate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TestResult({ provider }: { provider: ProviderSetting }) {
  if (!provider.lastTested) return null;
  const ok = provider.lastTestResult === "success";
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      Last tested {new Date(provider.lastTested).toLocaleString()} — {provider.lastTestResult}
    </div>
  );
}
