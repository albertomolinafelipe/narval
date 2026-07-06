import type { CreateClientConfig } from "./gen/client.gen";

// Applied to the generated client on init (hey-api runtimeConfigPath).
// Browser traffic goes through the Next proxy (/api/proxy) so SuperTokens
// session cookies are forwarded; server-side calls hit the API directly.
const isBrowser = typeof window !== "undefined";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: isBrowser
    ? "/api/proxy"
    : (process.env.INTERNAL_API_URL ?? "http://localhost:8080/api/v1"),
  credentials: "include",
});
