# Server

Go API server using [Gin](https://gin-gonic.com/) framework.

## Structure

```
server/
├── api/              # OpenAPI spec (see api/README.md)
├── cmd/
│   ├── migrate/      # DB migration entrypoint
│   └── server/       # Main server entrypoint
├── internal/
│   ├── api/          # HTTP handlers
│   ├── cache/        # Redis caching layer
│   ├── config/       # Environment configuration
│   ├── db/           # PostgreSQL queries and migrations
│   ├── middleware/   # Auth, logging, CORS
│   ├── storage/      # S3-compatible file storage
│   └── testutil/     # Test helpers
├── integration/      # Integration tests
└── models/           # Generated OpenAPI models
```

## Development

From the repo root:

```bash
make dev        # Start all services (server, web, postgres, redis, keycloak)
make server     # Run server only
make test       # Run tests
make generate   # Regenerate code from OpenAPI spec
```

## Code Generation

Models in `models/` are generated from the OpenAPI spec:

```bash
go generate ./...
```

See `api/README.md` for spec structure.
