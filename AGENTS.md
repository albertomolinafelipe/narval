# Narval — Agent Guide

This document is the entry point for any AI agent or developer working on this codebase. Read it before touching any code.

---

## Currently working on: Startups search UI/UX

Branch `search-ui`. This branch is **UI/UX only** — building out the search *experience and layout*, not the logic behind it. **No backend work** (server-side `?q=`, full-text search, ranking are out of scope, deferred to a later branch). Any advanced field whose filtering isn't wired up yet ships **disabled or marked WIP** — build the visual affordance, don't fake the behavior.

### Search constraints — the core model

All filtering funnels through one abstraction: a **constraint** is a predicate over a
`Startup` plus a display label. The visible list is every startup passing **all**
active constraints (AND). Map-pin clicks, field filters ("Founded ≥ 2020"), and future
advanced filters are all just constraints — adding a filter type means writing one more
factory, nothing else changes.

Lives in the selector layer: **`lib/startup/constraints.ts`** (per the [rendering
pattern](#rendering-pattern--one-entity-many-views)).

```ts
interface Constraint { id: string; label: string; test: (s: Startup) => boolean; }
applyConstraints(startups, constraints)   // startups passing every constraint
toggleConstraint(constraints, next)       // add if absent, remove if id present
locationConstraint(loc)                   // factory — one per filter type
```

How it composes today:

- **Free-text search** stays a **live filter** (not a constraint): the list is
  `textMatch(query) ∩ applyConstraints(constraints)`. Combined in the `filtered`
  `useMemo` in `startups-client.tsx`.
- **Map pins** — clicking a pin toggles a `locationConstraint` for that location
  (desktop **and** mobile). Clicking the same pin, or its chip, removes it. Constrained
  locations render highlighted on the map (`activeLocations`).
- **Constraint chips** render in a wrap-row **below the toolbar** (`ConstraintChips`);
  clicking a chip removes that constraint by `id`.

### Map as a toggle (not a separate view)

Map is an **on/off toggle** (`showMap`), not a list-vs-map view swap. The list stays put
on the left; the right panel shows the **map when on**, else the detail/placeholder. On
mobile (no side panel) map-on takes over full-width with the results list stacked below.

### Target design — expandable advanced search

Beyond text + pins, the search control expands (~**3× height**) into an advanced-filter
panel with structured fields — **geolocation**, **people** (founders/team), and room for
industry/stage later. Each field just pushes its constraint via a factory; **fields not
yet filterable client-side ship disabled or visibly WIP** — build the affordance, don't
fake the behavior.

### Ground rules for this branch

- **UI/UX only, no backend** — server-side `?q=`, full-text search, ranking are out of
  scope. Filtering is client-side over the already-fetched list.
- **Everything filterable goes through a constraint factory** in `lib/startup/constraints.ts` — don't scatter ad-hoc `.filter()` predicates across components.
- **Component consistency** — build on design tokens + shadcn primitives (`Input`,
  `SlideSwitch`, `ToggleGroup`, `Badge`, `components/ui/`); don't hand-roll raw elements.
- **Responsiveness** — every state must behave across breakpoints.

### Progress

- [x] **Toolbar restyle** — pill sort toggle; `SlideSwitch` for Map/Favorites/Details; search bar matched to the pill aesthetic; order: search, map, sort, favorite, detail.
- [x] **Map → on/off toggle** — right panel becomes the map; `reuseMaps` fixes the mapbox teardown race.
- [x] **Constraint model** — `lib/startup/constraints.ts`, chips below the toolbar, map pins toggle location constraints (desktop + mobile).
- [ ] **Expandable panel** — expand affordance + ~3× height advanced panel scaffold.
- [ ] **Advanced fields (UI)** — geolocation, people, etc. as controls feeding constraint factories; leave the rest disabled/WIP.
- [x] **Detail when no side panel** — when the map occupies the right panel (or on mobile), selecting a row expands it **inline** into the compact `StartupPageClient` card instead of navigating; the card's X collapses it, its header still links to the full page. Covers both list renderers (`StartupListRow` list and `StartupResultsList`).

### Next up: Admin-seeded startup profiles + claim flow

**Goal.** Let admins pre-build a startup's profile, then send that startup a link. The
startup clicks it, logs in with **their own** email, and takes ownership — outreach tool:
*"I already made your profile, come claim it."*

#### Core insight — reuse the edit page verbatim

Editing a startup is **not a form**: `app/startups/in/[id]/edit/page.tsx` renders the public
`StartupPageClient` with `editable`, which turns every field into an inline autosaving
control via `ProfileEditProvider` (`_profile/edit-context.tsx`), each field PATCHing itself.
So there is **nothing to reuse-by-copying** — an admin "create" is just:

1. Create an empty **shell** `Startup` **owned by the admin**, then
2. Redirect to the existing `/startups/in/[id]/edit`. No new edit UI.

#### The ownership trick, and lock-at-claim

Edit/update handlers are owner-gated (`st.OwnerID != ownerID` → 403, `handler.go`). Keep the
shell **owned by the admin** until claimed, so the admin edits it through the normal owner
path with **zero authorization changes**. **Claiming reassigns** `OwnerID`/`OwnerEmail` from
the admin to the startup — that reassignment *is* the handoff, and it's also what locks the
admin out: once ownership moves, the admin's owner check fails and they can no longer edit.
No "seal on exit" flag — the lock happens automatically at claim time. Before claim, the admin
can keep tweaking (useful if the startup asks for a fix first). Because auth is passwordless
OTP, no credential is ever transferred: the claim login itself proves the email.

#### One profile per email — scoped to claimed

An admin holds **many** unclaimed shells (all owned by their account), but every *real*
startup email must still map to exactly one profile. The rule is therefore **one *claimed*
startup per owner**, enforced by a **partial unique index** `owner_id WHERE claimed = true`
(replaces the ad-hoc one-per-owner check at `handler.go:279`). Unclaimed shells fall outside
it, so admins can seed freely; claiming flips `claimed = true` and reassigns ownership, so the
claimant lands at exactly one. `GetMe` (`auth/handler.go:358`) filters `claimed = true` so an
admin's shells never masquerade as "their profile."

#### No dashboard — links live in the admin's own doc

There is **no admin list/dashboard**. While editing an unclaimed shell, the edit page shows
two copy buttons (only when `claimed == false` and you're the owner):

1. **Copy claim link** — the bearer link sent to the startup.
2. **Copy edit link** — just `/startups/in/[id]/edit`, so the admin can return later.

The admin pastes both into their own notes. Re-editing is **pure ownership**, not the
whitelist — revisiting the saved edit link works until the startup claims it. The whitelist
only gates *creating* new shells. The edit link is owner-gated server-side (safe to store);
the **claim link is the secret** — treat it like a bearer credential.

#### Schema (`models/startup.go`)

- `Claimed bool` (default false)
- `ClaimToken string` (unique index; empty once claimed) — random, unguessable, single-use
- Partial unique index on `OwnerID WHERE claimed = true` (one claimed profile per owner)
- `OwnerID` stays `not null` (the admin owns the shell until claimed)

#### Backend

- **Admin gate:** session email ∈ `ADMIN_EMAILS` whitelist (env). No `admin` flag on `User` yet.
  Gates only shell **creation** — every other action is plain ownership.
- `POST /admin/startups` — create shell (name only; owner = admin; `Claimed=false`; random
  `ClaimToken`). Skips one-per-owner / account-type / website checks. Returns id + claim link.
- **Claim binding:** extend the login reconciliation (`accounts.LinkOrCreate`) with a *claim
  intent*: a valid unclaimed `ClaimToken` binds the authenticated user as owner
  (reassign `OwnerID`/`OwnerEmail`, set `AccountType=startup`, `Claimed=true`, burn token).
  Invalid or already-claimed → reject. Reuses the existing OTP/Google flow, not a parallel one.
- `GET /startups/claim/:token` — public: fetch the shell for the claim preview page.
- **Visibility:** public list/search/detail reads filter `claimed = true` so unclaimed shells
  stay invisible until claimed.

#### Frontend

- Admin-only **"New profile"** action (name → create shell → redirect to existing edit page).
- Edit page: **two copy buttons** (claim link, edit link) when the shell is unclaimed and owned.
- Public **`/claim/[token]`** landing: preview the profile + "log in with your email" (OTP)
  or Google → binds ownership on success.

#### Guardrails

- **`Verified` stays false** — claiming ≠ verified; the real owner still runs the existing
  domain-verification flow to earn the badge.
- **`ClaimToken` is a bearer capability** — single-use (burned on claim); consider email-pinning
  and expiry so a leaked link can't be claimed by the wrong person.
- **Never relax the public rule** — it's the partial unique index; admin multi-ownership only
  ever applies to *unclaimed* shells.

### Next up: Generated frontend API layer — kill the hand-plumbing

**Goal.** The Go side is fully generated from the OpenAPI spec (types + server stubs via
`oapi-codegen`). The frontend is not: it generates *types only* (`openapi-typescript`) and then
hand-plumbs everything on top of them, with the same shapes and enums copied by hand across
three layers. Bring the frontend to Go-side parity: **one spec → generated types, a typed
client per endpoint, React Query hooks, and Zod schemas**, so nothing is written twice.

The bar for this work is explicit: the end state must be **idiomatic, near-perfect, extendable,
and readable, with the duplication entirely gone** — not reduced, gone. No hand-maintained layer
should restate anything the spec already describes.

#### What's wrong today (the duplication to delete)

The generated types exist but almost nothing leans on them; the real API layer is written by hand.

1. **The typed client is dead code.** `lib/api/client.ts` builds a typed `openapi-fetch` client
   (`apiClient`) from the generated `paths` — and it is used **zero times**. Every real call
   (31 across 10 files) is a hand-rolled `fetch("/api/proxy/...")` restating URL, method,
   headers, and error handling each time.
2. **Enums are defined three times.** Generated types, then re-listed in `lib/enums.ts`, then
   **hardcoded as raw strings** in `lib/schemas/startup-schema.ts` (`VALID_STAGES`,
   `VALID_INDUSTRIES`, `VALID_ROUNDS`). The third copy isn't tied to the spec — a new backend
   enum value silently goes stale. This is a live drift bug, not a style nit.
3. **Validation hand-copies the API shape.** `startupProfileSchema` re-describes
   `UpdateStartupRequest` field by field in Zod.
4. **React Query hooks wrap hand-written fetch wrappers** (`lib/api/use-startups-query.ts`,
   `use-stats-query.ts`) — two hand-maintained layers where zero are needed.

#### Target — one generator, three layers, zero hand-copies

Adopt **`@hey-api/openapi-ts`** with its **TanStack Query** and **Zod** plugins — the TypeScript
equivalent of what `oapi-codegen` gives the Go side. From the single bundled spec it emits:

- a typed function per operation (replaces the 31 hand-rolled fetches and `client.ts`),
- React Query hooks (replaces the hand-written query/mutation wrappers),
- Zod schemas + inferred types (replaces the hand-copied validation shape and the enum copies).

Wire it into `make generate` alongside the Go step so one command regenerates both sides; commit
the output like the other generated files. Only **UI-only** validation with no API counterpart
(URL-format checks, human-facing max-length messages) stays hand-written — and it composes on top
of the generated schema, it does not re-declare the shape.

#### Ground rules

- **Spec is the single source of truth.** If a shape or enum lives in the OpenAPI spec, the
  frontend imports it — never restates it. Deleting a hand-copy is part of the work, not a
  follow-up.
- **Generated files are not hand-edited** — same rule as `generated.go`/`generated.ts`; change the
  spec, run `make generate`, commit the output.
- **Preserve the proxy.** All browser traffic goes through `/api/proxy/[...path]` for SuperTokens
  cookie forwarding — point the generated client's `baseUrl` at the proxy; don't bypass it.
- **Slice it and stop to test.** Land the generator + one feature end-to-end (startups
  list/detail) first, verify, then roll feature by feature — deleting the corresponding
  `client.ts` wrapper, hook, and enum/schema copy as each caller moves over.

#### Done means

`lib/api/client.ts`'s fetch wrappers, the duplicate lists in `lib/enums.ts`, and the hardcoded
enums/shape in `startup-schema.ts` are **removed**, replaced by generated code that tracks the
spec automatically. Adding or changing an endpoint is `make generate` + wire the UI — never
"update it in four places."

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

### Rendering pattern — one entity, many views

We render the same entities (`Startup`, `User`, …) in many places: list rows, the preview panel, the full page. **Derived display logic must be defined once and shared across all of them** — never duplicate "which fields are socials / how a URL is built / how a field is formatted" per screen. When two views drift, that's the bug this pattern prevents.

Three layers, each with a single job:

1. **Type — one source of truth.** Use the generated types (`components["schemas"]["Startup"]`). Never hand-write a parallel interface for an entity that already has a generated type.

2. **Selectors — pure functions that derive display data from the entity.** Anything that turns raw fields into something renderable (parsing `product_links`, building a social-link list, formatting team size) lives in a pure, JSX-free helper under `lib/<entity>/` — e.g. `lib/startup/socials.ts` exporting `getStartupSocials(startup): StartupLink[]` and `parseProductLinks()`. Registries (the canonical list of social platforms with their icon/label/prefix) live here, **once**. Adding a new link/field means editing exactly one file.

3. **Presentational components parameterized by a `variant`, not duplicated per screen.** One component renders a given piece of an entity and takes a prop for density/layout: `<StartupSocials startup={s} variant="compact" | "full" />`. Views differ in *layout*, never in *which data exists*. Compose these per view (list vs preview vs full page) instead of re-implementing the block.

**Read-only vs editable.** When a block is editable in one place (owner editing their profile) but read-only elsewhere (preview, list, other users' pages), split it: the **registry/selector is shared**, and the read-only renderer and the editable renderer both consume it. Don't hand-roll a second read-only copy alongside an editable one — they will drift.

> Concrete reference target: `Startup` socials/product-links. The `LINKS` registry currently lives inside `_profile/socials.tsx` (editable, coupled to `useProfileEdit`) while the compact panel in `startup-page-client.tsx` hand-rolls the same list — the canonical case this pattern exists to eliminate.

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
- **Render an entity the same way everywhere.** Derived display logic (parsing, formatting, link registries) goes in a pure selector under `lib/<entity>/`; presentational components take a `variant` prop instead of being copied per screen. See [Rendering pattern — one entity, many views](#rendering-pattern--one-entity-many-views). Never duplicate the same field-rendering logic across list/preview/full views.
- **Seed data** lives in `scripts/seed/main.go` as hardcoded Go structs. Logos are fetched from Clearbit; placeholder fallback is in `scripts/seed/assets/`.
- **Integration tests** are in `apps/server/integration/` and require a real Postgres + MinIO. Unit tests are co-located with the code they test (`_test.go` files).
