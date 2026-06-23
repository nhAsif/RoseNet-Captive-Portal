# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

RoseNet Access Portal is a self-contained Wi-Fi voucher authentication system for OpenWrt routers. It pairs a CGO-free Go backend with a vanilla-JS captive-portal frontend and integrates with **NoDogSplash (NDS)** for traffic interception. Everything runs on the router itself.

## Build & Run

The real Go module lives in `backend/` (`module voucher/backend`, **no external dependencies**). Always build from that directory.

```sh
# Local dev run (serves frontend/ and writes data/ in CWD)
cd backend && go build -o ../voucher_server . && cd .. && ./voucher_server

# Cross-compile for the router (set GOARCH to match: arm, arm64, mipsle)
cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o ../voucher_server .
# Then optionally: upx --best --lzma voucher_server
```

- `scripts/build.sh` — cross-compiles for `linux/arm` + UPX.
- `build.bat` — same for `linux/arm64` (Windows).
- `.github/workflows/release.yml` — builds amd64/arm64/arm/mipsle and publishes a release tarball on `v*` tags. Uses Go 1.22.
- Deployment: `scripts/install.sh` runs **on the router** — copies the binary to `/opt/voucher`, frontend to `/www/voucher`, installs an `init.d` service, and rewrites `/etc/config/nodogsplash`.

There is no test suite, linter config, or `go vet` gate in this repo.

> **Stale artifacts:** the root `go.mod`/`go.sum` still reference `mattn/go-sqlite3`. They are leftovers from the pre-v3.1 SQLite era — the project migrated to JSON persistence and the dependency is unused. The authoritative module is `backend/go.mod`. Don't reintroduce SQLite.

## Architecture

### Dev vs. production path detection
The backend has **no config file or flags**. It auto-detects environment at startup via `init()` probes:
- `backend/main.go` — if `/www/voucher` exists, serves frontend from there; else `frontend/`.
- `backend/database.go` — if `/data` exists, stores JSON there; else `data/` in CWD.

This is why the same binary works locally and on the router. Preserve this pattern rather than hardcoding paths.

### Persistence (`backend/database.go`)
JSON document store, not a real DB. All state lives in two in-memory caches (`vouchersCache`, `settingsCache`) guarded by a single `fileMutex`. Every mutation rewrites the whole file via `saveData()`. `loadData()` runs once at boot. The `Voucher` struct is the canonical schema. `settings.json` is a flat `map[string]string` holding `admin_password`, `active_theme`, and `currency_symbol`.

### Captive-portal auth flow (the core of the system)
1. Client connects → NDS intercepts → serves `splash.html` (written by `install.sh`), which meta-refreshes to `http://<router>:7891/?ip=&mac=&token=`.
2. Portal page (themed) collects the voucher code; frontend calls **`GET /binauth-stage`** which validates the voucher, marks it used, and writes the client MAC → duration into the in-memory `stagedAuths` map (**30-second TTL**).
3. Client is redirected to the NDS auth URL. NDS invokes `scripts/binauth.sh`, which curls **`GET /binauth-check?mac=`** and echoes `<seconds> 0 0` back to NDS to grant the session.
4. On server restart, `restageActiveUsers()` repopulates `stagedAuths` from still-valid used vouchers so active sessions survive reboots. `/binauth-check` also falls back to scanning vouchers by MAC if the staged entry expired.

`/auth` is a legacy endpoint kept for compatibility; the live flow is stage → check.

### Server (`backend/main.go`)
Single file, stdlib `net/http`, listens on **:7891**, logs to `/tmp/voucher.log` (a ramdisk on OpenWrt). Routes split into public (`/binauth-*`, `/`) and admin (`/admin/*`).

- **Admin auth is intentionally minimal**: `authMiddleware` checks for a cookie literally equal to `"admin-is-logged-in"` (10-min expiry). The admin password is stored **plaintext** in `settings.json`, default `rosepinepink`, seeded by `initializeAdminPassword`. This is by design for a LAN-only appliance — be aware before "hardening" it breaks the flow.
- `rootHandler` serves `themes/<active_theme>.html` for `/` and `/index.html`, falling back to `default.html`; all other paths fall through to a static `FileServer`.

### Frontend (`frontend/`)
**Client portal (no build step):** `index.html` and `themes/{default,modern,corporate,music}.html` are the swappable user-facing portal pages (selected by the `active_theme` setting). These stay vanilla HTML/JS on purpose — they run inside restricted captive-portal WebViews (Apple CNA, Android CaptivePortalLogin) where large JS bundles or ES modules can silently fail before internet access is granted. **Do not React-ify these.**

**Admin dashboard (compiled):** Source lives in `frontend-admin/` (React 18 + Vite + Tailwind CSS, charts via `react-chartjs-2`, icons via `lucide-react`). `npm run build` compiles static files into `frontend/admin/` (configured via `base: './'` + `outDir`), which the Go `FileServer` serves at **`/admin/`**. The legacy `frontend/admin.html` is now a redirect stub to `/admin/`. The admin runs in a normal browser *after* auth, so bundle size isn't a constraint there. **Edit `frontend-admin/src/`, then rebuild — never hand-edit `frontend/admin/`** (it's generated). `frontend/admin/` is **git-ignored** (generated output): CI builds it during releases (the `frontend` job in `release.yml`, shared with the build matrix via an artifact) and source installers build it once with `npm run build` (see README). Never rely on it being present in a fresh clone. Dev loop: `cd backend && go run .` (backend on :7891), then `cd frontend-admin && npm run dev` (Vite on :5173 proxies `/admin/*` to the backend).
