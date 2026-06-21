import * as XLSX from "xlsx";
import type { BusinessRecord } from "@/lib/types";

const COLUMNS: { key: keyof BusinessRecord; label: string }[] = [
  { key: "name", label: "Business Name" },
  { key: "category", label: "Category" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "lat", label: "Latitude" },
  { key: "lng", label: "Longitude" },
  { key: "website", label: "Website" },
  { key: "websiteStatus", label: "Website Status" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "socialLinks", label: "Social Links" },
  { key: "dataSource", label: "Data Source" },
  { key: "lastUpdated", label: "Last Updated" },
];

function flatten(r: BusinessRecord): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {};
  for (const c of COLUMNS) {
    let v: unknown = r[c.key];
    if (c.key === "socialLinks") {
      const s = r.socialLinks as Record<string, string | undefined>;
      v = Object.entries(s)
        .filter(([, val]) => val)
        .map(([k, val]) => `${k}: ${val}`)
        .join(" | ");
    }
    if (v == null) row[c.label] = null;
    else if (typeof v === "string") row[c.label] = v;
    else row[c.label] = String(v);
  }
  return row;
}

function csvEscape(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(records: BusinessRecord[]): string {
  const head = COLUMNS.map((c) => c.label).join(",");
  const lines = records.map((r) => {
    const flat = flatten(r);
    return COLUMNS.map((c) => csvEscape(flat[c.label] ?? null)).join(",");
  });
  return [head, ...lines].join("\r\n");
}

export function toJson(records: BusinessRecord[]): string {
  return JSON.stringify(records, null, 2);
}

export function toXlsx(records: BusinessRecord[]): Buffer {
  const rows = records.map(flatten);
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: COLUMNS.map((c) => c.label),
  });
  ws["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(c.label.length + 2, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function exportFilename(format: "csv" | "xlsx" | "json"): string {
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `leads-${ts}.${format}`;
}
