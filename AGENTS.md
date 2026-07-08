# Narval — Agent Guide

This document is the entry point for any AI agent or developer working on this codebase. Read it before touching any code.

---

## Currently working on: Project revision

A full audit of the codebase (backend, frontend, infra/CI, docs) was completed in July 2026.
The goal of this phase is to fix the findings below in **small, testable slices** — land one
slice, stop for manual testing, then continue. Decisions already taken:

- **Redis stays and gets used**: rate-limit the OTP-sending endpoints with it (finding A7/A8).
- **Slice order**: security + CI first, then spec-first consolidation, then structure/docs.
- **Structured logging** (`log/slog` + request IDs) and the **consolidated `/admin` console**
  are in scope for this revision; the rest of the long-term direction (see
  [Direction](#direction--engineering-north-star)) is documented but not part of these slices.
- **Unclaimed shells stay publicly listed** (product decision, July 2026): a completed
  (`profile_setup = true`) but unclaimed shell shows in the public list so the directory
  doesn't look empty pre-launch. Finding A4 is therefore reframed: the list query is
  correct; the stale comments/docs claiming shells are hidden are what get fixed.

### Fix slices

1. **Security/correctness quick wins** — MinIO anonymous policy → `download`; drop
   `owner_email` from public responses (frontend `isOwner` compares `profile_id` instead);
   resolve the boost-expiry contradiction (code says 30 days, a comment says 7); fix the
   stale `Claimed` model comment (shells are intentionally listed publicly, see decision
   above).
2. **CI hardening** — tests + lint gate the deploy on push to main; "generated code is stale"
   diff check; run the integration suite in CI.
3. **Spec-first consolidation (backend)** — add the six unspecced routes to the OpenAPI spec
   (admin routes get a proper security scheme), regenerate, delete `lib/api/client.ts`;
   align Go handlers with generated types/enums.
4. **Frontend dedup** — remove the legacy `openapi-typescript` layer (`generated.ts`), wire
   `zod.gen.ts` into `startup-schema.ts`, migrate the last hand-rolled fetches, unify the
   links registry.
5. **Robustness** — Redis rate limiting on OTP endpoints, graceful shutdown, partial unique
   index for one-claimed-profile-per-owner, claim-token index/expiry, fix the list N+1;
   **structured logging**: replace `log.Printf` with `log/slog` + request-ID middleware.
6. **Admin console** — consolidate the scattered admin UI (instagram verifications page,
   shell-creation button) under one `/admin` area with a single guard layout; add a
   shells/claims overview. See the admin direction below.
7. **Structure + docs** — split `startups/handler.go`, shared error/upload helpers, rename
   `storage.UploadLogo`, keep this file in sync.

### Audit findings

#### A. Bugs & security

- **A1 — MinIO bucket is anonymously writable.** `mc anonymous set public`
  (docker-compose.prod.yml:52, docker-compose.yml:64) grants anonymous read **and write** on
  the whole bucket, exposed at `storage.gonarval.com`. Must be `mc anonymous set download`.
- **A2 — Deploys run zero tests.** The CI `test` job is PR-only (ci.yml:11); a push to `main`
  builds and deploys untested. No lint job, no generated-code drift check, and the
  integration suite (`//go:build integration`, testcontainers) never runs anywhere. The
  Makefile `ci` target references a CI job (`integration`) that does not exist.
- **A3 — `owner_email` is public.** Every startup response includes it
  (startups/handler.go:702); the list endpoint exposes every founder's login email. The only
  consumer is the `isOwner` check in `startup-page-client.tsx:85`, which can use
  `user.profile_id === startup.id`.
- **A4 — Docs contradict the shell-visibility behavior (reframed).** `ListStartups` filters
  only `profile_setup = true` (startups/handler.go:179), while the `Claimed` model comment
  claims shells are "excluded from public reads". The behavior is the **intended** one
  (public listing of completed shells, decision above); the model comment and the original
  claim-flow design notes are what need fixing.
- **A5 — One-claimed-profile-per-owner is check-then-create.** The design called for a partial
  unique index `owner_id WHERE claimed = true`; what exists is racy application-side counts
  (startups/handler.go:288, accounts/accounts.go:115). `ClaimToken` also has no unique index
  (claim lookups scan the table), no expiry, no email pinning.
- **A6 — SuperTokens domains hardcoded.** `APIDomain: "http://localhost:8080"` and
  `WebsiteDomain: "http://localhost:3000"` in supertokens/init.go:87-88 — works in prod only
  because all traffic rides the cookie proxy. Should come from config.
- **A7 — No rate limiting on OTP endpoints.** `Register`/`Login`/`StartClaim` each send an
  email per request, unthrottled; also email enumeration (409 `EMAIL_EXISTS` on register,
  404 `USER_NOT_FOUND` on login).
- **A8 — Redis is entirely unused.** Connected in main.go, injected into `auth.Handler.rdb`,
  referenced zero times. Decision: use it for A7's rate limiting.
- **A9 — N+1 queries in `ListStartups`.** `startupResponse` runs three count queries per
  startup (boosts, is_favorited, has_boosted) → 3N+1 per list. The `trending` sort computes
  `active_boosts` in SQL and then discards it and re-queries per row.
- **A10 — Boost expiry is inconsistent.** Model `BeforeCreate` sets 30 days
  (models/startup_boost.go); a handler comment says 7 days (startups/handler.go:1021).
  Pick one and align code + docs.
- **A11 — Smaller items.** No graceful shutdown (`router.Run`, unmanaged cleanup goroutines);
  `CheckStartupWebsite` and `GetStats` ignore DB errors; uploads trust the client
  Content-Type and fall back to `image/jpeg` instead of rejecting non-images; raw
  `header.Filename` goes into object keys; `Verify`'s `pre_auth_session_id` request field is
  accepted and ignored; `Login` treats a failed draft insert as non-fatal but the subsequent
  verify then cannot succeed.

#### B. The half-finished "one spec, zero hand-copies" goal

- **B1 — Six routes live outside the OpenAPI spec** (internal/api/router.go):
  `POST /admin/startups`, `GET /startups/:id/claim-link`, `POST /auth/claim`,
  `GET /claim/:token`, `POST /startups/:id/founder-photo`, `POST /startups/:id/screenshot`.
  This is the root cause keeping `lib/api/client.ts` alive.
- **B2 — Two parallel generated frontend layers.** `npm run generate` runs both
  `openapi-typescript` (→ `src/lib/api/generated.ts`) and hey-api (→ `src/lib/api/gen/`);
  ~25 files still import the legacy `generated.ts` types.
- **B3 — `zod.gen.ts` is generated and never imported**, while
  `lib/schemas/startup-schema.ts` hand-codes `VALID_STAGES`/`VALID_INDUSTRIES`/`VALID_ROUNDS`
  as raw, untyped string arrays — a live drift bug (`lib/enums.ts` is typed against the
  generated unions and is safe; the schema copies are not).
- **B4 — The Go side is not spec-driven either.** Handlers restate enums by hand
  (startups/handler.go:32-51), duplicate `UpdateStartupRequest` as a hand-written
  `startupRequest` struct, and `startupResponse` hand-builds a ~45-field
  `map[string]interface{}` instead of using generated types. Adding a field means touching
  five places.
- **B5 — Five files still hand-fetch endpoints that are in the spec**: `auth-button.tsx`,
  `lib/user/context.tsx`, `profile-setup-checker.tsx`, `user-menu.tsx` (login/verify/me,
  startups list/detail). Migratable with no backend work.
- **B6 — The links registry is split**: `lib/startup/links.ts` (read-only selector) vs the
  `LINKS` array in `app/startups/_profile/socials.tsx` (editable) duplicate the
  platform/icon/prefix registry that the rendering pattern says must exist once.

#### C. Structure & idiom

- **C1** — `startups/handler.go` is 1078 lines mixing CRUD, four near-identical upload
  handlers, favorites, boosts, and response shaping. Split it; collapse the uploads into one
  parameterized helper.
- **C2** — `storage.Interface.UploadLogo` uploads logos, banners, screenshots, and founder
  photos. Rename to `Upload`.
- **C3** — ~50 hand-rolled `gin.H{"code": ..., "message": ...}` responses; add one
  error-response helper.
- **C4** — Dead/stale code: `middleware.boolPtr`; "UserID stores the Keycloak ID" comments on
  `StartupFavorite`/`StartupBoost` (it is the local `users.id`); model `json` tags nothing
  serializes.
- **C5** — `config.Validate` only checks MinIO creds in production; `SUPERTOKENS_API_KEY`,
  `RESEND_API_KEY`, and a default `DATABASE_URL` pass silently.
- **C6** — The pre-commit hook in `.githooks/` is inert: nothing sets `core.hooksPath`.
- **C7** — Test coverage: the auth handler (466 lines, security-critical) has zero unit
  tests; the web app has exactly one component test; the integration suite never runs in CI.

---

## Direction — engineering north star

Where the project is heading as a system — infrastructure, code quality, and process.
Functionality and design are out of scope here. Not launched yet: every item below is
sized for one droplet and one developer + agents; the theme is **boring, declarative,
and reversible**. Items marked *(active)* are part of the current revision slices;
everything else is direction to follow when the work naturally arises — don't build
ahead of need.

### Testing

The stack is DB-heavy handlers + a mostly-presentational frontend, so the pyramid is
integration-weighted, not unit-weighted:

- **Integration tests are the backbone** *(active)*. The testcontainers suite in
  `apps/server/integration/` grows to cover every endpoint's happy path plus
  auth/ownership failure cases, and runs on every PR. Handler confidence comes from
  here, not from unit tests with mocked DBs (never mock GORM).
- **Go unit tests for pure logic only**: `accounts` reconciliation, validators,
  normalizers, selectors. Table-driven, co-located.
- **Frontend unit tests** (Vitest + Testing Library) for anything with logic — the
  constraint model, selectors, form schemas are pure functions and cheap to cover.
  No snapshot tests.
- **A small Playwright e2e suite** — 4–6 golden paths (browse → detail, auth via the
  test-env bearer shortcut, inline edit autosave, claim flow) against the compose
  stack. The e2e count is a budget, not a goal; it stays small forever.
- **A bug fix lands with the test that would have caught it.**

### Code & libraries

- **Prefer maintained libraries over hand-rolling** — shadcn/ui for components,
  TanStack Query for data, react-hook-form + zod for forms, `go-redis/redis_rate`
  for rate limiting. Reinventing a solved mechanic needs a reason.
- **Migrations move to goose** (plain SQL files, versioned in git); `AutoMigrate` is
  retired once goose lands. AutoMigrate cannot express partial unique indexes
  (finding A5) and blocks real schema work.
- **Non-goals** (do not churn): no ORM or framework swaps, no microservices, no
  Kubernetes. Gin + GORM + Next.js are settled.

### CI

Target pipeline *(active — slice 2)*: on PR — `lint` (golangci-lint, ESLint,
prettier-check), `generate-check` (`make generate && git diff --exit-code`), Go unit
tests, integration tests, web tests + build. On push to main — the **same gates**,
then image build/push and deploy. Everything parallel, target under ~5 minutes.

### Infrastructure

Principle: **the droplet's runtime state lives in git's control loop**; SSH is for
incident debugging only, never for configuration. In order:

1. **Config sync on deploy** — the deploy job rsyncs `docker-compose.prod.yml` and
   `Caddyfile` to the droplet before `up -d`. (Today they were copied once by hand;
   editing them in the repo currently does nothing.)
2. **Secrets** — render `/opt/narval/.env` from GitHub environment secrets in the
   deploy job, removing the last hand-maintained file.
3. **Backups** — nightly `pg_dump` to DO Spaces plus a written restore runbook.
   There is currently no backup story at all; this outranks any IaC work.
4. **Terraform, plain — no Terragrunt** — codify droplet, DNS records, firewall,
   Spaces bucket, reserved IP. Terragrunt only if/when multiple environments exist.
5. **Scale path (written, not built):** first bottleneck → managed Postgres; then
   split web/server onto separate instances; container orchestration only when
   genuinely forced. Terraform state makes each step a diff instead of a rebuild.

### Analytics

Umami is the right tool; the gap is discipline, not tooling:

- **One typed event taxonomy** in `lib/analytics.ts` — the only way to track.
  Event names are `object_verb` (`startup_boosted`, `claim_link_opened`,
  `search_constraint_added`).
- **UTM-tagged claim links** so outreach conversion is measurable.
- **Umami's API feeds the `/admin` console** (top startups, signups, funnel basics).
- Future product feature, not just ops: startups see their own profile-view stats.

### Observability

- **Now** *(active — slice 5)*: structured logging — `log/slog` with a request-ID
  middleware; every log line carries the request ID. This is the foundation any
  future tooling builds on.
- **At/after launch**: error tracking (Sentry or self-hosted GlitchTip — undecided)
  and an external uptime ping on `/health`.
- **Not while it's one box**: Prometheus, Grafana, tracing. Dashboards for a single
  service on a single droplet are decoration.

### Admin

The philosophy stays: **ownership does the heavy lifting, admin is a thin whitelist
on top** (`ADMIN_EMAILS` — auditable in git, changed by redeploy). What changes
*(active — slice 6)*:

- All admin UI consolidates under **`/admin`** behind one guard layout — the
  instagram-verifications console moves in, plus a shells/claims overview and, later,
  the analytics summary and basic user/startup lookup.
- Admin endpoints live **in the OpenAPI spec** with a proper security scheme, like
  everything else (slice 3).
- `is_admin` rides the session payload instead of being recomputed per request.
- A DB `is_admin` column happens only when someone who can't redeploy needs admin
  rights — not before.

---

## What is Narval?

Narval is a web platform where startups present themselves and get discovered. Users can browse startup profiles, bookmark favourites, and boost the ones they find compelling. Startups register and manage their own profiles. Admins can pre-build "shell" profiles that startups claim via a one-time link.

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
├── docker-compose.prod.yml  # Production stack (adds Caddy, uses GHCR images)
├── Caddyfile            # Production reverse proxy config
├── go.work              # Go workspace linking apps/server and scripts/seed
├── flake.nix / flake.lock  # Nix dev environment — pins toolchain (Go, Node, etc.)
├── .envrc               # direnv hook that loads the Nix dev shell on `cd`
├── .githooks/           # pre-commit lint hook (requires `git config core.hooksPath .githooks`)
├── Makefile             # Primary developer interface — see `make help`
└── AGENTS.md            # This file
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | Go 1.25, Gin, GORM, oapi-codegen |
| Auth | SuperTokens (passwordless OTP + optional Google OAuth) |
| Transactional email | Resend (`RESEND_API_KEY`) — both OTP delivery and domain-verification codes |
| Database | PostgreSQL 16 |
| Cache | Redis 7 (currently unused — earmarked for OTP rate limiting, see finding A8) |
| Object storage | MinIO (S3-compatible) |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, React Query |
| Frontend codegen | @hey-api/openapi-ts (SDK + TanStack Query + Zod) — migration from openapi-typescript in progress (finding B2) |
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
make seed          # Seed the database with curated startup profiles
make seed-reset    # Wipe seed rows and re-seed from scratch
make generate      # Regenerate Go server code + TypeScript client from OpenAPI spec
make test          # Run Go unit tests + Vitest
make lint          # Lint and auto-fix all code (golangci-lint + ESLint + Prettier)
make lint-check    # Check-only lint (used by the pre-commit hook)
make build         # Build Docker images (production)
make down          # Stop all Docker services
make clean         # Stop all services and delete all data volumes
```

---

## Data Models

### `Startup` (`apps/server/models/startup.go`)
The core entity. Owned by a `User` with `account_type = "startup"`. Key fields:
- Identity: `name`, `tagline`, `description`, `about`, `website`, `logo_url`, `banner_image`
- Metadata: `stage`, `industry`, `team_size`, `location`, `founded_year`, `tech_stack`
- Product: `product_links`, `product_status`, `gallery` (max 4), `features` (max 8), `video_url`
- Funding: `is_raising`, `current_round`, `funding_ask`, `funding_use`
- Hiring: `is_hiring`, `open_roles`
- Socials: `linkedin`, `twitter`, `github`, `instagram` (+ `instagram_verified`)
- Contact: `contact_general`, `contact_funding`, `contact_talent`
- Verification: `verified` + `verified_domain` (domain flow), `instagram_verified` (DM flow)
- Claim flow: `claimed`, `claim_token` (never serialized), `owner_id`, `owner_email`
- `profile_setup` — `false` until the profile is completed; public list filters on it

Several fields are JSON-in-a-string columns (`founders`, `gallery`, `features`,
`milestones`, `product_links`) — parsed by selectors on the frontend and capped
(`capGalleryJSON`, `capFeaturesJSON`) on the backend.

### `User` (`apps/server/models/user.go`)
Stores app-level user data. Identity (sessions, OTPs) is handled by SuperTokens.
- `account_type`: `"user"` | `"startup"` — investors are coming soon (page exists as placeholder)
- There is no `admin` flag: admin rights come from the `ADMIN_EMAILS` env whitelist,
  surfaced as `is_admin` in `GET /auth/me`.
- Startup accounts get a `Startup` row at registration (or by claiming a shell)

### `StartupFavorite` / `StartupBoost`
Social actions. `user_id` is the local `users.id` (not the SuperTokens id — old "Keycloak"
comments in the models are stale, finding C4). Boosts expire — model sets 30 days at
creation; hourly cleanup goroutine in `main.go` purges expired rows. (A handler comment
says 7 days; resolving this is finding A10.)

### `DomainVerification` / `InstagramVerification`
One live challenge per startup (unique `startup_id`). Domain: hashed 6-digit code emailed
to an address at the claimed root domain, 15 min TTL, 5 attempts. Instagram: plaintext
correlation code the owner DMs from the claimed handle; an admin confirms in the console
at `/admin/instagram-verifications`. Editing the Instagram handle clears the verification.

### `RegistrationDraft`
Temporary row created during the OTP flow (register, login, and claim); carries
`account_type`, `name`, and optionally `claim_token` into `Verify`. Deleted after verify;
rows older than 7 days are purged hourly.

---

## The claim flow (admin-seeded profiles)

Shipped in #18. How it works:

1. A whitelisted admin (`ADMIN_EMAILS`) creates a shell via `POST /admin/startups`
   (name only). The shell is **owned by the admin** (`claimed = false`, random
   `claim_token`), so the admin edits it through the normal owner-gated edit page —
   zero authorization changes.
2. The edit page shows copy buttons for the claim link and edit link while the shell is
   unclaimed. There is no admin dashboard; links live in the admin's own notes.
3. The startup opens `/claim/[token]`, previews the profile, and verifies **their own
   email via OTP** (`POST /auth/claim` → `Verify`). Google claim is **not** supported —
   the OAuth intent cookie carries no claim token (`supertokens/init.go`).
4. `accounts.bindClaim` reassigns `owner_id`/`owner_email`, sets `claimed = true`, burns
   the token — atomically in a transaction. The ownership move is what locks the admin out.
5. `verified` stays false — claiming is not verification; the owner still runs the domain
   flow to earn the badge.

Visibility: a completed (`profile_setup = true`) shell **is publicly listed even before it
is claimed** — deliberate, so the directory has content pre-launch. What stays hidden is the
claim machinery (`claim_token` never serialized, `GetMe` only counts `claimed = true`
profiles as "yours").

Known gap (finding A5): one-claimed-profile-per-owner is enforced in code, not by the
designed partial unique index.

---

## API

### OpenAPI spec
Split source files live in `apps/server/api/`. The bundled spec `openapi.bundled.yaml` is generated by `make generate` — do not edit it manually.

```bash
make generate   # Bundle spec → Go server stubs (oapi-codegen) → TS client (hey-api)
```

Generated files (committed, never hand-edited):
- `apps/server/internal/api/generated.go` — Go server interface + types
- `apps/web/src/lib/api/gen/` — hey-api output: typed SDK, TanStack Query options, Zod schemas
- `apps/web/src/lib/api/generated.ts` — **legacy** openapi-typescript types, being removed (finding B2)

**Any time you add, remove, or change an API endpoint or schema, run `make generate`.**

**Spec-first rule:** every endpoint belongs in the OpenAPI spec. Six routes currently
bypass it (finding B1) — do not add more; slice 3 moves them into the spec.

### Auth flow
1. `POST /auth/register` — creates SuperTokens OTP, stores draft (rejects existing emails)
2. `POST /auth/verify` — consumes OTP, reconciles the local user via `accounts.LinkOrCreate`, creates session
3. `POST /auth/login` — same OTP flow for existing users
4. `POST /auth/claim` — OTP flow for claiming a shell (accepts new and existing emails)
5. `GET /auth/me` — current user + `is_admin` + `profile_id`/`logo_url` for startup accounts
6. `POST /auth/logout` — revokes the SuperTokens session

Google OAuth (optional, enabled when `GOOGLE_CLIENT_ID/SECRET` are set) flows through the
same `accounts.LinkOrCreate` reconciliation; registration intent travels in a short-lived
cookie (`narval_reg_intent`).

### Frontend API proxy
All browser traffic goes through `/api/proxy/[...path]`
(`apps/web/src/app/api/proxy/[...path]/route.ts`), which forwards cookies and SuperTokens
headers. The generated client's `baseUrl` points at the proxy in the browser and at
`INTERNAL_API_URL` server-side (`lib/api/runtime-config.ts`). Never bypass the proxy.

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
│   ├── startups/          # List page (startups-client.tsx, map, constraints UI)
│   │   ├── _components/   # List rows, detail placeholder
│   │   ├── _profile/      # Profile tabs + inline-editable field components
│   │   ├── [slug]/        # Public page by verified domain
│   │   └── in/[id]/       # Public page by UUID (+ /edit — owner editing)
│   ├── claim/[token]/     # Public claim landing page
│   ├── admin/instagram-verifications/  # Admin console for IG verification
│   ├── awards / about / investors     # Static or placeholder pages
│   └── api/proxy/[...path]/           # Cookie-forwarding API proxy
├── lib/
│   ├── api/               # gen/ (hey-api output) + legacy layer being removed
│   ├── startup/           # Selectors: links, product-links, constraints
│   ├── user/              # User context (account_type, profile_id, logo_url)
│   └── schemas/           # Zod form schemas (startup-schema.ts — see finding B3)
└── config/
    └── supertokens.ts     # SuperTokens client config
```

### Generated API layer — current state

The target is unchanged: **one spec → generated types, SDK, React Query hooks, Zod schemas;
nothing written twice.** hey-api (`gen/`) is wired up and most calls go through it
(`use-startups-query.ts` wraps the generated SDK). What remains (findings B1–B5):

- `lib/api/client.ts` — hand fetches for the six unspecced endpoints; delete after slice 3.
- `lib/api/generated.ts` — legacy type layer still imported by ~25 files; migrate imports
  to `gen/types.gen.ts` and drop `openapi-typescript` from `npm run generate`.
- `lib/schemas/startup-schema.ts` — must compose on `gen/zod.gen.ts` instead of hand-copying
  enum values; only UI-only validation (URL formats, human messages) stays hand-written.
- A handful of components still `fetch("/api/proxy/...")` for endpoints already in the spec.

### Rendering pattern — one entity, many views

We render the same entities (`Startup`, `User`, …) in many places: list rows, the preview panel, the full page. **Derived display logic must be defined once and shared across all of them.**

1. **Type — one source of truth.** Use the generated types. Never hand-write a parallel interface for an entity that already has a generated type.
2. **Selectors — pure functions** under `lib/<entity>/` that derive display data (e.g. `lib/startup/links.ts` → `getStartupSocials`, `lib/startup/product-links.ts`). Registries live here, once.
3. **Presentational components take a `variant` prop** instead of being copied per screen. Views differ in layout, never in which data exists.

**Read-only vs editable:** the registry/selector is shared; the read-only renderer and the
editable renderer both consume it. The `LINKS` array in `_profile/socials.tsx` still
duplicates `lib/startup/links.ts` (finding B6) — the canonical violation to eliminate.

### Search constraints

All list filtering funnels through one abstraction in `lib/startup/constraints.ts`: a
**constraint** is a predicate over a `Startup` plus a display label; the visible list is
every startup passing all active constraints (AND). Free-text search stays a live filter
combined with the constraints in `startups-client.tsx`. Map pins toggle location
constraints; chips below the toolbar remove them. Adding a filter type = one more factory
in `constraints.ts` — never scatter ad-hoc `.filter()` predicates across components.
The map is an on/off toggle (`showMap`) occupying the right panel, not a separate view.

---

## Infrastructure

### Local development

**Dev environment (Nix flake).** The toolchain (Go, Node, and friends) is pinned by `flake.nix` / `flake.lock`. With Nix + direnv installed, `cd` into the repo and `.envrc` loads the dev shell automatically (`direnv allow` on first entry); otherwise run `nix develop`.

All services are defined in `docker-compose.yml`. The `server` and `web` services require `--profile full` (or `make dev`). Infrastructure services (postgres, redis, minio, supertokens, umami) start without a profile.

Copy `.env.example` to `.env`. `RESEND_API_KEY` is optional locally (emails just won't send); `NEXT_PUBLIC_MAPBOX_TOKEN` is required for the map.

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

**CI/CD pipeline** (`.github/workflows/ci.yml`) — actual current behavior:
- Pull requests → `test` (Go unit tests + Vitest) and `test-build` jobs
- Push to `main` → `build-server` + `build-web` (generate, build images, push to GHCR),
  then `deploy` (SSH to droplet, pull, `docker compose up -d`)
- **Known gaps (finding A2, slice 2):** pushes to main run no tests; there is no lint job;
  the integration suite never runs; generated-code drift is not checked.

**Required GitHub repo secrets:** `DROPLET_IP`, `DEPLOY_SSH_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`.

**Required DNS records:** `A` records for `gonarval.com`, `analytics.gonarval.com`, `storage.gonarval.com` → droplet IP.

**One-time droplet setup (fresh Ubuntu 24.04):**
```bash
apt-get update -qq && apt-get install -y curl
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/narval

# Copy files from repo root
scp docker-compose.prod.yml Caddyfile root@<droplet-ip>:/opt/narval/

# Write /opt/narval/.env with real secrets (never commit this file).
# See .env.production.example for the full variable list.
# Generate passwords with: openssl rand -hex 32

# First deploy (subsequent deploys are automatic via CI)
cd /opt/narval && docker compose -f docker-compose.prod.yml up -d
```

**Important `.env` notes:**
- `MINIO_ACCESS_KEY` must NOT be `narval` — the server rejects it as insecure in production. It must match `MINIO_ROOT_USER`.
- `RESEND_API_KEY` is the only third-party secret that must be set manually (Resend, with the gonarval.com domain verified).
- Umami is auto-provisioned by the `umami-setup` service with a fixed website id (see `.env.production.example`); no manual UI setup needed.

**Server config** (`apps/server/internal/config/config.go`) env vars:
- `DATABASE_URL`, `REDIS_ADDR`
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`, `MINIO_PUBLIC_URL`
- `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional — Google sign-in off when empty)
- `ADMIN_EMAILS` (comma-separated whitelist for shell creation + admin console)
- `CORS_ORIGINS` (comma-separated), `ENV=production`, `PORT=8080`

---

## What is NOT done yet (coming soon)

- **Investor profiles** — the `/investors` page exists as a "coming soon" placeholder. The DB table, model, and API routes were intentionally removed for the MVP. Do not add them back without a product decision.
- **Server-side search** — filtering is client-side over the fetched list (constraints model). Server-side `?q=`, full-text search, and ranking are deferred.
- **Google claim** — claiming a shell works via OTP only; supporting Google requires carrying the claim token through the OAuth intent cookie.
- **Zitadel migration** — SuperTokens is the current auth provider. A branch (`1-switch-to-zitadel`) was started but deferred.

---

## Conventions

- **Spec is the single source of truth.** If a shape, enum, or endpoint exists, it lives in the OpenAPI spec and both sides import generated code. Never restate it by hand — deleting hand-copies is part of any change that touches them.
- **Do not edit generated files** (`generated.go`, `lib/api/gen/`, `openapi.bundled.yaml`, legacy `generated.ts`). Change the source, run `make generate`, commit the output.
- **No comments unless the WHY is non-obvious.** Identifiers should be self-documenting.
- **Tailwind classes** use a custom design token set (CSS variables like `--color-brand`, `--color-bg-raised`). Follow existing patterns.
- **Use shadcn/ui whenever possible** (manually token-mapped, `cn` util, `components/ui/`) before hand-rolling raw elements.
- **Render an entity the same way everywhere.** Selectors under `lib/<entity>/`, `variant` props over copies. See the rendering pattern section.
- **Everything list-filterable goes through a constraint factory** in `lib/startup/constraints.ts`.
- **Small slices, stop to test.** Land one coherent slice, pause for manual verification, then continue.
- **Seed data** lives in `scripts/seed/main.go` as hardcoded Go structs. Logos are fetched from Clearbit; placeholder fallback is in `scripts/seed/assets/`.
- **Integration tests** are in `apps/server/integration/` (build tag `integration`, testcontainers — needs Docker). Unit tests are co-located with the code they test.
