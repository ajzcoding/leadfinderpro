# 🔍 Lead Finder Pro

> A complete, **personal-use** web application for finding local business leads from **legal, authorized data sources**, scanning their public websites for contact information, and exporting clean lead lists.

**No login. No accounts. No billing. Launches straight to the Dashboard.**

---

## ✨ Features

- 📊 **Dashboard** — live stats: total businesses, websites found/not found, emails, phones, saved projects, recent searches & projects
- 🔎 **Search** — by country, state, city, category, keyword, radius, and data provider. Optional website scanning. Save results directly to a project
- 📋 **Results** — paginated data table with filters (website/email/phone availability, category, city, state, text search). Click any row for a full detail dialog with re-scan, assign-to-project, and delete actions
- 📁 **Projects** — create / rename / delete collections; assign leads; export a project
- 📤 **Export** — CSV, Excel (.xlsx), JSON. Filtered scope. Full export history
- 🕐 **Search History** — every search auto-logged (keyword, category, location, provider, result count, date). Re-open any search's results or clear history
- ⚙️ **Settings** — manage provider API keys (paste / save / edit / delete / test connection / enable-disable). Keys stored locally in SQLite, never returned raw to the client
- 🌓 **Dark / Light mode**, responsive layout, loading skeletons, toast notifications, duplicate detection, retry-friendly provider fallback, structured logging

---

## 🛡️ Legal & Authorized Data Sources

Lead Finder Pro uses **only public APIs** with their own terms of service. It does **NOT** scrape Google Maps or bypass any third-party Terms of Service.

| Provider | Key required | Free? | Notes |
|----------|:------------:|:-----:|-------|
| **OpenStreetMap (Overpass)** | ❌ | ✅ | Default. ODbL-licensed. No key needed. |
| **Nominatim** | ❌ | ✅ | Free geocoding (city → coordinates). |
| **Geoapify** | ✅ | ✅ | Free tier. Places API. |
| **Foursquare** | ✅ | ✅ | Places API. |
| **TomTom** | ✅ | ✅ | Search API. |
| **Google Maps Places** | ✅ | ❌ | Industry-leading data. Billed per request. |

OpenStreetMap works with **zero configuration**. The other providers can be enabled by pasting an API key on the **Settings** page — no code changes or rebuilds required.

Website scanning respects each site's `robots.txt` and fetches only publicly accessible pages (Home, Contact, About).

---

## 🧰 Tech Stack

| Layer | Technology |
|------|-----------|
| Framework | **Next.js 16** (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + next-themes |
| Database | **SQLite** via Prisma ORM |
| State | Zustand (UI) + TanStack Query (server) |
| Exports | CSV / JSON / XLSX (`xlsx`) |
| Icons | Lucide React |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:

| Tool | Version | Why | Install Link |
|------|---------|-----|--------------|
| **Node.js** | ≥ 20.x | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **Bun** | ≥ 1.1.x | Package manager + dev runner (recommended) | [bun.sh](https://bun.sh/) |
| **Git** | ≥ 2.x | Version control | [git-scm.com](https://git-scm.com/) |

> 💡 **Why Bun?** This project uses Bun for faster installs and dev server startup. You *can* use npm/pnpm instead (see "Alternative package managers" below), but the commands in this README use `bun`.

### Verify your installation

```bash
node --version   # should print v20.x or higher
bun --version    # should print 1.1.x or higher
git --version    # should print 2.x or higher
```

---

## 🚀 Installation (Step by Step)

### Step 1 — Clone the repository

```bash
git clone https://github.com/<your-username>/lead-finder-pro.git
cd lead-finder-pro
```

### Step 2 — Install dependencies

Using **Bun** (recommended):

```bash
bun install
```

This installs all dependencies listed in `package.json` (Next.js, Prisma, shadcn/ui components, xlsx, etc.).

### Step 3 — Configure the database

The app uses a local SQLite database file. The database URL is already configured in `.env`:

```bash
# .env (already present in the repo)
DATABASE_URL="file:/home/z/my-project/db/custom.db"
```

Create the database schema by running:

```bash
bun run db:push
```

This runs `prisma db push`, which:
1. Reads `prisma/schema.prisma`
2. Creates the SQLite database file (if it doesn't exist)
3. Creates all tables: `Business`, `Project`, `SearchHistory`, `Setting`, `ExportHistory`, `Log`

You should see output like:

```
🚀  Your database is now in sync with your Prisma schema. Done in 31ms
✔ Generated Prisma Client (v6.x) to ./node_modules/@prisma/client
```

### Step 4 — Start the development server

```bash
bun run dev
```

You should see:

```
▲ Next.js 16.x (Turbopack)
- Local:        http://localhost:3000
✓ Ready in 977ms
```

### Step 5 — Open the app

Open your browser and navigate to **`http://localhost:3000`**.

The app launches **directly to the Dashboard** — no login required. 🎉

---

## ⚙️ Configuring API Keys (Optional but Recommended)

OpenStreetMap works out of the box with no configuration. To enable the other providers:

1. Click **Settings** in the sidebar
2. For each provider you want to enable:
   - Click the provider's docs link to get an API key
   - Paste the key into the **API Key** field
   - Click **Save**
   - Click **Test Connection** to verify
3. Use the **toggle switch** to enable/disable a provider

### Where to get API keys

| Provider | Sign-up URL |
|----------|-------------|
| Geoapify | [apidocs.geoapify.com](https://apidocs.geoapify.com/) — free tier, no credit card |
| Foursquare | [developer.foursquare.com](https://developer.foursquare.com/) — free tier |
| TomTom | [developer.tomtom.com](https://developer.tomtom.com/) — free tier |
| Google Maps | [developers.google.com/maps](https://developers.google.com/maps) — requires billing account; enable **Places API (New)** |

> 🔒 **Security:** API keys are stored only in your local SQLite database and are **never** returned to the browser in plaintext. The Settings page shows only a masked preview (e.g. `AIza••••••••••••abc`). Keys are sent **only** to the provider they belong to during a search.

---

## 🎯 Quick Start Guide

Once the app is running, here's how to find your first leads:

1. **Go to Search** → click "Search" in the sidebar
2. **Enter a location** → e.g. City: `Berlin`, Country: `Germany`
3. **Pick a category** → e.g. "Restaurants & Cafes"
4. **Set the radius** → drag the slider (0.5–25 km)
5. **Choose a provider** → OpenStreetMap (free) is selected by default
6. **(Optional) Enable website scanning** → toggle "Scan websites for contact info"
7. **Click "Search Businesses"** → watch the live progress
8. **View results** → you'll be taken to the Results page automatically
9. **Filter & export** → use the filter bar, then click CSV / Excel / JSON to download

---

## 📁 Project Structure

```
lead-finder-pro/
├── prisma/
│   └── schema.prisma           # Database schema (Business, Project, etc.)
├── src/
│   ├── app/
│   │   ├── api/                # REST API route handlers
│   │   │   ├── dashboard/
│   │   │   ├── search/
│   │   │   ├── business/
│   │   │   ├── project/
│   │   │   ├── export/
│   │   │   ├── settings/
│   │   │   ├── history/
│   │   │   └── logs/
│   │   ├── globals.css         # Tailwind + theme variables
│   │   ├── layout.tsx          # Root layout (theme + providers)
│   │   └── page.tsx            # Main app (single route, view-switching)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── views/              # Dashboard, Search, Results, Projects, Export, History, Settings
│   │   ├── app-shell.tsx       # Sidebar + topbar + footer layout
│   │   ├── business-detail-dialog.tsx
│   │   ├── stat-card.tsx
│   │   ├── mode-toggle.tsx
│   │   ├── theme-provider.tsx
│   │   └── providers.tsx       # TanStack Query provider
│   └── lib/
│       ├── types.ts            # Shared types + provider metadata
│       ├── db.ts               # Prisma client singleton
│       ├── store.ts            # Zustand UI store
│       ├── api-client.ts       # Typed fetch wrappers
│       ├── mappers.ts          # Prisma ↔ API record mapping + dedup hash
│       ├── security.ts         # Input validation + SSRF protection
│       ├── logging.ts          # DB-backed structured logging
│       ├── settings-store.ts   # Provider config CRUD helpers
│       ├── providers/          # Data source integrations
│       │   ├── geocode.ts      # Nominatim geocoding
│       │   ├── osm.ts          # OpenStreetMap Overpass
│       │   ├── geoapify.ts
│       │   ├── foursquare.ts
│       │   ├── tomtom.ts
│       │   ├── googlemaps.ts   # Google Maps Places API
│       │   └── index.ts        # Unified search dispatcher
│       ├── scan/
│       │   └── scanner.ts      # robots.txt-aware website scanner
│       └── export/
│           └── exporters.ts    # CSV / JSON / XLSX generators
├── db/                         # SQLite database file (auto-created)
├── docs/                       # Documentation
├── exports/                    # Export artifacts target
├── logs/                       # Log artifacts target
├── .env                        # Environment variables (DATABASE_URL)
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md                   # This file
```

---

## 🔌 REST API Reference

All endpoints live under `/api/*` and return JSON unless streaming a file.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/dashboard` | Aggregate stats + recent activity |
| `POST` | `/api/search` | Run a provider search, persist + dedup, optional website scan |
| `GET` | `/api/business` | List businesses (paginated, filtered) |
| `PATCH` | `/api/business` | Update a business (assign project, edit fields) |
| `DELETE` | `/api/business?id=` | Delete a business |
| `POST` | `/api/business` | `{action:"scan", id}` — re-scan a website |
| `GET` | `/api/project` · `?id=` | List projects / get one with its businesses |
| `POST` · `PATCH` · `DELETE` | `/api/project` | Project CRUD |
| `GET` | `/api/export?format=` | Download CSV/XLSX/JSON (filtered) |
| `GET` | `/api/export?history=1` | Export history list |
| `GET` · `POST` | `/api/settings` | Read (masked) / save / test / delete / toggle provider config |
| `GET` · `DELETE` | `/api/history` | Search history list / delete |
| `GET` | `/api/logs` | Diagnostic logs |

### Example: run a search via curl

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Berlin",
    "country": "Germany",
    "category": "restaurant",
    "radius": 5000,
    "provider": "openstreetmap",
    "scanWebsites": false
  }'
```

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the dev server on `http://localhost:3000` |
| `bun run lint` | Run ESLint to check code quality |
| `bun run db:push` | Push the Prisma schema to SQLite (create/update tables) |
| `bun run db:generate` | Regenerate the Prisma Client |
| `bun run db:migrate` | Create + apply a migration (dev) |
| `bun run db:reset` | Reset the database (⚠️ deletes all data) |
| `bun run build` | Build for production (not needed for local use) |
| `bun run start` | Start the production server (after build) |

---

## 🔒 Security

Lead Finder Pro is designed for **personal, local use** and includes several security hardening measures:

- **Input validation** — every API input is validated, length-bounded, and sanitized (control chars stripped, allow-list enforced)
- **SSRF protection** — the website scanner refuses to fetch loopback/private/link-local/cloud-metadata URLs
- **API key masking** — keys are never returned to the browser in plaintext; only a masked preview is shown
- **Path safety** — export filenames are server-generated (no user input), preventing path traversal / header injection
- **robots.txt respect** — the website scanner fetches and honors each site's robots.txt rules
- **`X-Content-Type-Options: nosniff`** — set on all export downloads
- **Provider fallback** — if a configured provider fails or is rate-limited, the app falls back to OpenStreetMap automatically

### Reporting a security issue

If you find a security vulnerability, please open a private GitHub Security Advisory instead of a public issue.

---

## 🐛 Troubleshooting

### "Overpass API returned HTTP 429"

The OpenStreetMap Overpass API is rate-limited. The app automatically rotates across 5 mirror endpoints and retries, so this should be rare. If it persists:

- Wait 30–60 seconds and try again
- Reduce the search radius (smaller area = smaller query)
- Enable a keyed provider (Geoapify/Foursquare/TomTom) in Settings as a backup

### "Could not resolve the provided location"

The free Nominatim geocoder couldn't find your city. Try:
- Using a more specific city name (e.g. "Berlin, Germany" instead of just "Berlin")
- Checking for typos
- Adding the country field

### "Database is locked" or Prisma errors

```bash
bun run db:push    # re-sync the schema
# or, to start fresh (⚠️ deletes all data):
bun run db:reset
```

### Port 3000 is already in use

Edit `package.json` and change the `dev` script's `-p 3000` to another port, e.g. `-p 3001`.

---

## 📦 Alternative package managers

Prefer npm or pnpm? Just swap the commands:

```bash
# npm
npm install
npm run db:push
npm run dev

# pnpm
pnpm install
pnpm db:push
pnpm dev
```

---

## 🤝 Contributing

This is a personal-use project, but contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development guidelines

- Use TypeScript throughout (strict mode)
- Prefer shadcn/ui components over custom implementations
- Run `bun run lint` before committing
- Don't add authentication — this is intentionally auth-free for personal use
- Always use legal, authorized data sources

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

> **Data license:** Business data sourced from OpenStreetMap is © OpenStreetMap contributors and licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright). Data from other providers is subject to their respective terms of service.

---

## ⚖️ Disclaimer

This application is intended for **personal, single-user, local use only**. The user is responsible for:

- Complying with each data provider's Terms of Service and quota limits
- Ensuring their use of scraped contact information complies with applicable laws (e.g. GDPR, CAN-SPAM, CCPA)
- Respecting the privacy preferences of businesses they contact

The authors of this software are not responsible for any misuse.

---

## 🙏 Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/) & contributors — the foundation of free geographic data
- [Nominatim](https://nominatim.org/) — free geocoding
- [Overpass API](https://overpass-api.de/) — powerful OSM data access
- [Next.js](https://nextjs.org/), [Prisma](https://www.prisma.io/), [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/) — the excellent toolchain

---

<p align="center">
  Built with ❤️ for finding local business leads, ethically.
</p>
