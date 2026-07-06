# Narval

The platform for startup discovery

<img src="apps/web/public/logo.jpeg" alt="Narval" width="300" />

## Functionalities

- Sign in with email (OTP) or Google
- Browse and list startups
- View startups on an interactive map
- Edit your profile with inline autosaving fields
- Claimable accounts: admins pre-build a profile, the startup claims it with their own email

## Frontend

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Query for data fetching
- Mapbox GL for the map
- Typed API client generated from the OpenAPI spec (hey-api)

## Backend

- Go + Gin + GORM
- PostgreSQL (data), Redis (cache), MinIO (object storage)
- SuperTokens for passwordless auth
- Server stubs + types generated from the OpenAPI spec (oapi-codegen)

## Infrastructure

- Runs on a single VM as a Docker Compose stack
- Caddy reverse proxy with automatic HTTPS
