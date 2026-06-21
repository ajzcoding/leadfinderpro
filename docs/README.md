# Lead Finder Pro

A complete, **personal-use** web application for finding local business leads from **legal, authorized data sources**, scanning their public websites for contact information, and exporting clean lead lists.

> No login. No accounts. No billing. Launches straight to the Dashboard.

---

## Tech Stack

| Layer | Technology |
|------|-----------|
| Framework | **Next.js 16** (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | **SQLite** via Prisma ORM |
| State | Zustand (UI) + TanStack Query (server) |
| Theming | next-themes (light/dark) |
| Exports | CSV / JSON / XLSX (`xlsx`) |

The original spec called for Vite+React+Express. This implementation adapts that to the
mandated Next.js 16 runtime: **Next.js API routes replace Express**, and **internal
view-switching navigation replaces React Router** (the app exposes a single user-visible
route `/`). Every functional requirement from the spec is preserved.

---

## Data Sources (all legal & authorized)

| Provider | Key required | Notes |
|----------|--------------|-------|
| **OpenStreetMap (Overpass)** | ❌ No | Default. ODbL-licensed. Free. |
| **Nominatim** | ❌ No | Free geocoding (city → coordinates). |
| **Geoapify** | ✅ Yes | Free tier. Places API. |
| **Foursquare** | ✅ Yes | Places API. |
| **TomTom** | ✅ Yes | Search API. |

OpenStreetMap works with **zero configuration**. The other providers can be enabled by
pasting an API key on the **Settings** page — no code changes or rebuilds required.

Website scanning respects each site's `robots.txt` and fetches only publicly accessible
pages (Home, Contact, About).

---

## Features

- **Dashboard** — live stats: total businesses, websites found/not found, emails, phones,
  saved projects, recent searches & projects.
- **Search** — by country, state, city, category, keyword, radius, provider. Optional
  website scanning. Save results directly to a project.
- **Results** — paginated data table with filters (website/email/phone availability,
  category, city, state, text search). Click any row for a full detail dialog with
  re-scan, assign-to-project, and delete actions.
- **Projects** — create / rename / delete collections; assign leads; export a project.
- **Export** — CSV, Excel (.xlsx), JSON. Filtered scope. Full export history.
- **Search History** — every search auto-logged (keyword, category, location, provider,
  result count, date). Re-open any search's results or clear history.
- **Settings** — manage provider API keys (paste / save / edit / delete / test connection /
  enable-disable). Keys stored locally in SQLite, never returned raw to the client.
- **Dark / Light mode**, responsive layout, loading skeletons, toast notifications,
  duplicate detection (hash-based dedup), retry-friendly provider fallback, structured
  logging to the local DB.

---

## REST API

All endpoints live under `/api/*` and return JSON unless streaming a file.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dashboard` | Aggregate stats + recent activity |
| POST | `/api/search` | Run a provider search, persist + dedup, optional website scan |
| GET | `/api/business` | List businesses (paginated, filtered) |
| PATCH | `/api/business` | Update a business (assign project, edit fields) |
| DELETE | `/api/business?id=` | Delete a business |
| POST | `/api/business` | `{action:"scan", id}` re-scan a website |
| GET | `/api/project` · `?id=` | List projects / get one with its businesses |
| POST · PATCH · DELETE | `/api/project` | Project CRUD |
| GET | `/api/export?format=` | Download CSV/XLSX/JSON (filtered) |
| GET | `/api/export?history=1` | Export history list |
| GET · POST | `/api/settings` | Read (masked) / save / test / delete / toggle provider config |
| GET · DELETE | `/api/history` | Search history list / delete |
| GET | `/api/logs` | Diagnostic logs |

---

## Project Structure

```
prisma/schema.prisma          # Business, Project, SearchHistory, Setting, ExportHistory, Log
src/lib/
  types.ts                    # shared types + provider metadata + categories
  db.ts                       # Prisma client singleton
  store.ts                    # Zustand UI store (active view, filters, refresh)
  api-client.ts               # typed fetch wrappers for every /api endpoint
  mappers.ts                  # Prisma ↔ API record mapping + dedup hash
  logging.ts                  # DB-backed structured logging
  settings-store.ts           # provider config CRUD helpers
  providers/                  # geocode + osm + geoapify + foursquare + tomtom + dispatcher
  scan/scanner.ts             # robots.txt-aware website contact scanner
  export/exporters.ts         # CSV / JSON / XLSX generators
src/app/api/                  # all REST route handlers
src/components/               # app shell, sidebar, views, shared UI
docs/                         # this documentation
exports/                      # (runtime) export artifacts target
logs/                         # (runtime) log artifacts target
```

---

## Local Development

```bash
bun install
bun run db:push     # create/migrate SQLite schema
bun run dev         # start dev server on :3000
bun run lint        # ESLint
```

Open the app via the **Preview Panel** (it runs on `http://localhost:3000` internally).

---

## Legal & Compliance

- Uses only **public APIs** with their own terms of service (OpenStreetMap ODbL, Nominatim,
  Geoapify, Foursquare, TomTom). No scraping of Google Maps or any ToS-violating source.
- Website scanner fetches only **publicly accessible pages** and honors `robots.txt`.
- Email/phone extraction is limited to information the business **publishes on its own site**.
- The user is responsible for complying with each provider's usage policy and quota limits.

---

## Personal Use

This application is intended for **personal, single-user, local use only**. It contains no
authentication, multi-tenancy, or network exposure beyond the local dev server.
