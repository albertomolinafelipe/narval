# API Specification

OpenAPI 3.0 spec for the Narval API.

## File Structure

The API specification is split into multiple files for better organization:

```
api/
├── openapi.yaml              # Main entry point (references only)
├── openapi.bundled.yaml      # Auto-generated bundle (gitignored)
├── components/
│   └── schemas/              # Schema definitions
│       ├── Error.yaml
│       ├── AccountType.yaml
│       ├── LoginRequest.yaml
│       └── ... (one file per schema)
└── paths/                    # Endpoint definitions
    ├── health.yaml
    ├── auth_login.yaml
    ├── auth_register.yaml
    ├── startups.yaml
    └── ... (one file per path)
```

## Code Generation

```bash
# From repo root
make generate

# Or manually
cd apps/server && go generate ./...
cd apps/web && npm run generate
```

The `make generate` command:
1. **Bundles** the split OpenAPI files into `openapi.bundled.yaml`
2. **Generates** Go models, server interface and TypeScript types

## Extending the API

### Adding a new schema

1. Create a new file in `components/schemas/` (`MySchema.yaml`):
2. The schema is automatically available for use in path files via `$ref: ../components/schemas/MySchema.yaml`

### Adding a new endpoint

1. Create a new file in `paths/` (`my_endpoint.yaml`):
2. Reference it in `openapi.yaml` via `$ref: paths/my_endpoint.yaml`
3. Run `make generate` to regenerate code
4. Implement the new handler in `internal/api/`
