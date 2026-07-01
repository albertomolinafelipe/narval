# Narval — Agent Guide

This document is the entry point for any AI agent or developer working on this codebase. Read it before touching any code.

---

## 🚧 Currently working on: Prettify & maintain the frontend

Branch `prettify-home-page`. The theme of this branch is **polishing and maintaining the web frontend** — not new features. Concretely:

- **Responsiveness** — make pages behave well across mobile/tablet/desktop breakpoints.
- **Component consistency** — unify spacing, colors, and interaction patterns around the existing design tokens + shadcn primitives; replace hand-rolled elements with shared components.
- **Refactoring** — break up large page/client files, extract reusable pieces, tidy structure.
- **Visual polish** — landing/home page and the `/startups` pages.

Keep changes focused and non-behavioral where possible; this is cleanup, not a rewrite.

### Progress

- [x] **Stale image cache fix (logo + banner)** — logo/banner were stored at a fixed object key (`logos/<id>/logo.jpg`) and overwritten in place, so the URL never changed and MinIO's missing `Cache-Control` header served stale bytes. `handler.go` now prepends `time.Now().UnixMilli()` to logo/banner object keys (matching screenshots/founders) for a unique URL per upload. Orphan cleanup left as a separate TODO.
- [~] **Home page polish** — in progress.
- [~] **Startups list page** — `/startups` list view now uses a **persistent right-hand detail panel**: the list stays a fixed width and the panel is always shown, rendering a static placeholder (`StartupDetailPlaceholder`) until a startup is clicked, then swapping to its details. Clicking the already-selected startup opens its full page. (`startups-client.tsx`)

---

## What is Narval?

Narval is a web platform where startups present themselves and get discovered. Users can browse startup profiles, bookmark favourites, and boost the ones they find compelling. Startups register and manage their own profiles.

**Current status:** MVP — keep changes focused and minimal.

---

## Repository Layout

```
narval/
├── apps/
│   ├── server/          # Go API server (Gin + GORM + SuperTokens)
│   └── web/             # Next.js 15 frontend (App Router, TypeScript, Tailwind)
├── scripts/
│   └── seed/            # Standalone Go module — seeds the database via MinIO + Postgres
├── docker-compose.yml   # Full local stack (postgres, redis, minio, supertokens, umami)
├── go.work              # Go workspace linking apps/server and scripts/seed
├── flake.nix / flake.lock  # Nix dev environment — pins toolchain (Go, Node, etc.)
├── .envrc               # direnv hook that loads the Nix dev shell on `cd`
├── Makefile             # Primary developer interface — see `make help`
└── AGENTS.md            # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Go 1.25, Gin, GORM, oapi-codegen |
| Auth | SuperTokens (passwordless OTP via email, SMTP through Zoho) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Object storage | MinIO (S3-compatible) |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, React Query |
| Analytics | Umami |
| API spec | OpenAPI 3.0 (split YAML under `apps/server/api/`) |

---

## Key Commands

Always use the `Makefile` — don't invoke tools directly.

```bash
make help          # List all commands with descriptions
make dev           # Start everything in Docker (full compose + seed)
make dev-api       # Infra in Docker, Go server locally with air (hot reload)
make dev-web       # Infra + server in Docker, Next.js locally
make seed          # Seed the database with 10 curated startup profiles
make seed-reset    # Wipe seed rows and re-seed from scratch
make generate      # Regenerate Go server code + TypeScript client from OpenAPI spec
make test          # Run Go unit tests + Vitest
make lint          # Lint and auto-fix all code (golangci-lint + ESLint + Prettier)
make build         # Build Docker images (production)
make down          # Stop all Docker services
make clean         # Stop all services and delete all data volumes
```

---

## Data Models

### `Startup` (`apps/server/models/startup.go`)
The core entity. Owned by a `User` with `account_type = "startup"`. Key fields:
- Identity: `name`, `tagline`, `description`, `website`, `logo_url`, `banner_image`
- Metadata: `stage`, `industry`, `team_size`, `location`, `founded_year`, `tech_stack`
- Funding: `is_raising`, `current_round`, `funding_ask`, `funding_use`
- Hiring: `is_hiring`, `open_roles`
- Socials: `linkedin`, `twitter`, `github`, `instagram`
- Contact: `contact_general`, `contact_funding`, `contact_talent`
- `profile_setup` — `false` until the founder completes the edit form

### `User` (`apps/server/models/user.go`)
Stores app-level user data. Identity (sessions, OTPs) is handled by SuperTokens.
- `account_type`: `"user"` | `"startup"` — investors are coming soon (page exists as placeholder)
- Startup accounts auto-get a `Startup` row on first login

### `StartupFavorite` / `StartupBoost`
Social actions. Boosts expire (hourly cleanup goroutine in `main.go`).

### RegistrationDraft
Temporary row created during OTP flow; deleted after verify.

---

## API

### OpenAPI spec
Split source files live in `apps/server/api/`. The bundled spec `openapi.bundled.yaml` is generated by `make generate` — do not edit it manually.

```bash
make generate   # Bundle spec → generate Go server stubs → generate TypeScript client
```

The generated files are:
- `apps/server/internal/api/generated.go` — Go server interface + types
- `apps/web/src/lib/api/generated.ts` — TypeScript types for the frontend

These generated files are now **tracked in git** (committed, not gitignored) so the repo builds without a generate step and diffs are reviewable. Don't hand-edit them — change the OpenAPI source and re-run `make generate`, then commit the regenerated output alongside your change.

**Any time you add, remove, or change an API endpoint or schema, run `make generate`.**

### Auth flow
1. `POST /auth/register` — creates SuperTokens OTP, stores draft
2. `POST /auth/verify` — consumes OTP, creates User + (optionally) Startup, creates session via SuperTokens cookies
3. `POST /auth/login` — same OTP flow for existing users
4. `GET /auth/me` — returns current user + `profile_id` / `logo_url` for startup accounts
5. `POST /auth/logout` — revokes SuperTokens session

### Frontend API proxy
The Next.js app proxies all API calls through `/api/proxy/[...path]` (`apps/web/src/app/api/proxy/[...path]/route.ts`). This forwards cookies so SuperTokens sessions work across origins in dev.

---

## Frontend Structure

```
apps/web/src/
├── app/
│   ├── _components/       # Shared layout + auth components
│   │   ├── auth/          # AuthModal, AuthButton, AuthModalContext
│   │   ├── forms/         # RegisterForm, RegisterCompanyForm, LocationInput, PillInput
│   │   ├── layout/        # AppHeader, UserMenu, NarvalLogo, ThemeToggle
│   │   └── shared/        # BoostButton, BoostCounter, ListPanel, ImageCropper…
│   ├── _lib/              # Providers, SuperTokens wrapper, Umami analytics
│   ├── startups/          # Startup list page + detail page
│   │   └── [id]/          # Individual startup page
│   ├── investors/         # Coming soon placeholder
│   ├── profile/           # Startup profile edit form (auth-gated)
│   ├── about/             # Static about page
│   └── layout.tsx         # Root layout with providers
├── lib/
│   ├── api/               # API client, React Query hooks, generated types
│   ├── user/              # User context (account_type, profile_id, logo_url)
│   └── schemas/           # Zod schemas for forms (startup-schema.ts)
└── config/
    └── supertokens.ts     # SuperTokens client config
```

---

## Infrastructure

### Local development

**Dev environment (Nix flake).** The toolchain (Go, Node, and friends) is pinned by `flake.nix` / `flake.lock`. With Nix + direnv installed, `cd` into the repo and `.envrc` loads the dev shell automatically (`direnv allow` on first entry); otherwise run `nix develop`. This replaces manually installing language runtimes — use the flake so everyone builds against the same versions.

All services are defined in `docker-compose.yml`. The `server` and `web` services require `--profile full` (or `make dev`). Infrastructure services (postgres, redis, minio, supertokens, umami) start without a profile.

Copy `.env.example` to `.env` and fill in `SMTP_PASSWORD` (Zoho mail password for `contact@gonarval.com`).

### Production deployment

Production runs on a single Digital Ocean droplet at `gonarval.com`.

**Architecture:**
```
Internet (443/80)
  └── Caddy (auto-HTTPS via Let's Encrypt)
        ├── gonarval.com           → web:3000 (Next.js)
        ├── analytics.gonarval.com → umami:3000
        └── storage.gonarval.com   → minio:9000

Docker-internal only (no public ports):
  web → server:8080 (via /api/proxy/)
  server → supertokens:3567
  server → postgres:5432
  server → redis:6379
  server → minio:9000
```

The Go server is **never publicly exposed** — all browser traffic goes through the Next.js proxy at `/api/proxy/[...path]`. SuperTokens browser SDK is also routed through this proxy (`apiDomain = NEXT_PUBLIC_SITE_URL`, `apiBasePath = /api/proxy/auth`).

**CI/CD pipeline** (`.github/workflows/ci.yml`):
- Every push/PR → `test` job (Go unit tests + web Vitest)
- Push to `main` → `build-server` + `build-web` jobs in parallel (generate code, build Docker images, push to GHCR)
- After both builds → `deploy` job (SSH to droplet, pull images, `docker compose up -d`)

No manual SSH needed for routine deploys — just push to `main`.

**Required GitHub repo secrets:**
- `DROPLET_IP` — droplet's public IP
- `DEPLOY_SSH_KEY` — private key matching the public key in `/root/.ssh/authorized_keys` on the droplet
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox token (baked into web image at build time)

**Required DNS records:**
- `A gonarval.com → <droplet-ip>`
- `A analytics.gonarval.com → <droplet-ip>`
- `A storage.gonarval.com → <droplet-ip>`

**One-time droplet setup (fresh Ubuntu 24.04):**
```bash
# Install Docker and create deploy directory
apt-get update -qq && apt-get install -y curl
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/narval

# Copy files from repo root
scp docker-compose.prod.yml Caddyfile root@<droplet-ip>:/opt/narval/

# Write /opt/narval/.env with real secrets (never commit this file)
# Required variables — generate passwords with: openssl rand -hex 32
#   POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD, UMAMI_APP_SECRET, UMAMI_ADMIN_PASSWORD
#   SMTP_PASSWORD (Zoho app password for contact@gonarval.com)
# See .env.production.example for the full variable list.

# First deploy (subsequent deploys are automatic via CI)
cd /opt/narval && docker compose -f docker-compose.prod.yml up -d
```

**Important `.env` notes:**
- `MINIO_ACCESS_KEY` must NOT be `narval` — the server rejects it as insecure in production. Use `narval-app` or similar.
- `MINIO_ACCESS_KEY` must match `MINIO_ROOT_USER` (MinIO uses root credentials as the access key in simple setups).
- `SMTP_PASSWORD` is the only secret that must be set manually (Zoho app password).

**Production make commands:**
```bash
make deploy-logs     # Tail prod logs via SSH (set DROPLET_IP=<ip>)
make deploy-seed     # Seed production DB (builds binary, SSHes to droplet, runs in Docker network)
```

**Umami setup (one-time after first deploy):**
1. Visit `https://analytics.gonarval.com` → login with `admin` / the `UMAMI_ADMIN_PASSWORD` from `.env`
2. Add website `gonarval.com` → copy the Website ID
3. Set `UMAMI_WEBSITE_ID=<id>` in `/opt/narval/.env`
4. `cd /opt/narval && docker compose -f docker-compose.prod.yml restart web`

**Server config** (`apps/server/internal/config/config.go`) reads these env vars in production:
- `DATABASE_URL`, `REDIS_ADDR`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`, `MINIO_PUBLIC_URL`
- `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_FROM_NAME`
- `CORS_ORIGINS` (comma-separated, e.g. `https://gonarval.com`)
- `ENV=production`, `PORT=8080`

---

## What is NOT done yet (coming soon)

- **Investor profiles** — the `/investors` page exists as a "coming soon" placeholder. The DB table, model, and API routes have been intentionally removed for the MVP. Do not add them back without a product decision.
- **Zitadel migration** — SuperTokens is the current auth provider. A branch (`1-switch-to-zitadel`) was started but deferred.

---

## Conventions

- **Do not edit generated files** (`generated.go`, `generated.ts`, `openapi.bundled.yaml`). Change the source, run `make generate`.
- **No comments unless the WHY is non-obvious.** Identifiers should be self-documenting.
- **Tailwind classes** use a custom design token set (CSS variables like `--color-brand`, `--color-bg-raised`). Follow existing patterns.
- **Use shadcn/ui whenever possible** for frontend components (buttons, inputs, selects, dialogs, etc.). The web app uses shadcn manually token-mapped (`cn` util, `components/ui/`), not `shadcn init`. Reach for an existing or new shadcn primitive before hand-rolling raw `<button>`/`<input>`/`<select>` elements.
- **Seed data** lives in `scripts/seed/main.go` as hardcoded Go structs. Logos are fetched from Clearbit; placeholder fallback is in `scripts/seed/assets/`.
- **Integration tests** are in `apps/server/integration/` and require a real Postgres + MinIO. Unit tests are co-located with the code they test (`_test.go` files).
