// Thin typed fetch wrappers around the /api/* endpoints.

import type {
  BusinessRecord,
  DashboardStats,
  ProviderId,
  ResultFilter,
  SearchParams,
} from "@/lib/types";

async function json<T>(resOrPromise: Response | Promise<Response>): Promise<T> {
  const res = await resOrPromise;
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---------- Dashboard ----------
export interface DashboardData extends DashboardStats {
  recentSearchList: {
    id: string;
    keyword: string | null;
    category: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    provider: string | null;
    totalResults: number;
    date: string;
  }[];
  recentProjects: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    businessCount: number;
    updatedAt: string;
  }[];
}

export async function fetchDashboard(): Promise<DashboardData> {
  return json(await fetch("/api/dashboard", { cache: "no-store" }));
}

// ---------- Search ----------
export interface SearchResult {
  searchHistoryId: string;
  totalResults: number;
  businesses: BusinessRecord[];
  center: { lat: number; lng: number; displayName: string } | null;
}

export async function runSearch(params: SearchParams): Promise<SearchResult> {
  return json(
    await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),
  );
}

// ---------- Business ----------
export interface BusinessListResponse {
  total: number;
  page: number;
  pageSize: number;
  businesses: BusinessRecord[];
}

export function fetchBusinesses(filter: ResultFilter & {
  page?: number;
  pageSize?: number;
}): Promise<BusinessListResponse> {
  const q = new URLSearchParams();
  if (filter.page) q.set("page", String(filter.page));
  if (filter.pageSize) q.set("pageSize", String(filter.pageSize));
  if (filter.projectId) q.set("projectId", filter.projectId);
  if (filter.searchHistoryId) q.set("searchHistoryId", filter.searchHistoryId);
  if (filter.websiteAvailable === true) q.set("websiteAvailable", "true");
  if (filter.websiteAvailable === false) q.set("websiteAvailable", "false");
  if (filter.emailAvailable === true) q.set("emailAvailable", "true");
  if (filter.emailAvailable === false) q.set("emailAvailable", "false");
  if (filter.phoneAvailable === true) q.set("phoneAvailable", "true");
  if (filter.phoneAvailable === false) q.set("phoneAvailable", "false");
  if (filter.category) q.set("category", filter.category);
  if (filter.city) q.set("city", filter.city);
  if (filter.state) q.set("state", filter.state);
  if (filter.search) q.set("search", filter.search);
  return json(fetch(`/api/business?${q}`, { cache: "no-store" }));
}

export async function updateBusiness(
  id: string,
  data: Partial<Pick<BusinessRecord, "projectId" | "websiteStatus" | "email" | "phone">> & {
    socialLinks?: Record<string, string>;
  },
): Promise<BusinessRecord> {
  return json(
    await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    }),
  );
}

export async function deleteBusiness(id: string): Promise<void> {
  await fetch(`/api/business?id=${id}`, { method: "DELETE" });
}

export async function rescanBusiness(id: string): Promise<BusinessRecord> {
  return json(
    await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", id }),
    }),
  );
}

// ---------- Projects ----------
export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  businessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  businesses: BusinessRecord[];
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  return json(fetch("/api/project", { cache: "no-store" }));
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  return json(fetch(`/api/project?id=${id}`, { cache: "no-store" }));
}

export async function createProject(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<ProjectSummary> {
  return json(
    await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}

export async function updateProject(
  id: string,
  data: { name?: string; description?: string; color?: string },
): Promise<ProjectSummary> {
  return json(
    await fetch("/api/project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    }),
  );
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/project?id=${id}`, { method: "DELETE" });
}

// ---------- Settings ----------
export interface ProviderSetting {
  provider: ProviderId;
  name: string;
  requiresKey: boolean;
  free: boolean;
  description: string;
  docsUrl: string;
  hasKey: boolean;
  apiKeyMasked: string | null;
  enabled: boolean;
  lastTested: string | null;
  lastTestResult: string | null;
}

export async function fetchSettings(): Promise<ProviderSetting[]> {
  return json(fetch("/api/settings", { cache: "no-store" }));
}

export async function saveProviderConfig(
  provider: ProviderId,
  apiKey: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  return json(
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "save", apiKey, enabled }),
    }),
  );
}

export async function deleteProviderConfig(provider: ProviderId): Promise<{ ok: boolean }> {
  return json(
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "delete" }),
    }),
  );
}

export async function toggleProvider(
  provider: ProviderId,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  return json(
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "toggle", enabled }),
    }),
  );
}

export async function testProvider(
  provider: ProviderId,
  apiKey?: string,
): Promise<{ ok: boolean; message: string }> {
  return json(
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, action: "test", apiKey }),
    }),
  );
}

// ---------- History ----------
export interface HistoryItem {
  id: string;
  keyword: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  radius: number | null;
  provider: string | null;
  totalResults: number;
  businessCount: number;
  date: string;
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  return json(fetch("/api/history", { cache: "no-store" }));
}

export async function deleteHistory(id?: string): Promise<void> {
  const url = id ? `/api/history?id=${id}` : "/api/history";
  await fetch(url, { method: "DELETE" });
}

// ---------- Export ----------
export interface ExportHistoryItem {
  id: string;
  format: string;
  count: number;
  filename: string;
  filter: string | null;
  projectId: string | null;
  date: string;
}

export async function fetchExportHistory(): Promise<ExportHistoryItem[]> {
  return json(fetch("/api/export?history=1", { cache: "no-store" }));
}

export function buildExportUrl(
  format: "csv" | "xlsx" | "json",
  filter: ResultFilter,
): string {
  const q = new URLSearchParams();
  q.set("format", format);
  if (filter.projectId) q.set("projectId", filter.projectId);
  if (filter.searchHistoryId) q.set("searchHistoryId", filter.searchHistoryId);
  if (filter.websiteAvailable === true) q.set("websiteAvailable", "true");
  if (filter.websiteAvailable === false) q.set("websiteAvailable", "false");
  if (filter.emailAvailable === true) q.set("emailAvailable", "true");
  if (filter.emailAvailable === false) q.set("emailAvailable", "false");
  if (filter.phoneAvailable === true) q.set("phoneAvailable", "true");
  if (filter.phoneAvailable === false) q.set("phoneAvailable", "false");
  if (filter.category) q.set("category", filter.category);
  if (filter.city) q.set("city", filter.city);
  if (filter.state) q.set("state", filter.state);
  if (filter.search) q.set("search", filter.search);
  return `/api/export?${q}`;
}
