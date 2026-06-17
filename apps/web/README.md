# Web

Next.js frontend with React 19 and Tailwind CSS 4.

## Structure

```
web/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── _components/  # Shared UI components
│   │   ├── _lib/         # App-specific utilities
│   │   ├── api/          # API routes (auth callbacks)
│   │   ├── investors/    # Investor pages
│   │   ├── startups/     # Startup pages
│   │   ├── bookmarks/    # Bookmarks page
│   │   └── profile/      # User profile
│   └── lib/
│       └── api/          # Generated API client
└── patches/              # Package patches (patch-package)
```

## Development

From the repo root:

```bash
make dev        # Start all services
make web        # Run frontend only (requires backend)
```

## Key Libraries

- **next-auth** - Authentication via Keycloak
- **@tanstack/react-query** - Server state management
- **openapi-fetch** - Type-safe API client
- **mapbox-gl** - Map components

## Code Generation

The API client in `src/lib/api/generated.ts` is generated from the OpenAPI spec:

```bash
npm run generate
```

## Testing

```bash
npm run test        # Run once
npm run test:watch  # Watch mode
```
