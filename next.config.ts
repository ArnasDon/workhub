import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM Postgres) is only loaded in local dev mode (DATABASE_URL=pglite://…).
  // Keep it out of the server bundle so production builds never ship or resolve it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
