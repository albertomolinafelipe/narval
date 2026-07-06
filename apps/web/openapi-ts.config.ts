import { defineConfig } from "@hey-api/openapi-ts";

// Generates the frontend API layer from the bundled OpenAPI spec:
// types, a typed SDK (one function per operation), TanStack Query hooks,
// and Zod schemas. Output lives in src/lib/api/gen and is committed.
// Regenerate with `make generate` — never hand-edit the output.
export default defineConfig({
  input: "../server/api/openapi.bundled.yaml",
  output: {
    path: "src/lib/api/gen",
  },
  plugins: [
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: "./src/lib/api/runtime-config",
    },
    "@hey-api/typescript",
    "@hey-api/sdk",
    "@tanstack/react-query",
    "zod",
  ],
});
