import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(import.meta.dirname, "../..");

// Local development reads the monorepo's one .env. Variables already set win,
// and in production the file does not exist: Docker Compose sets the
// environment, and the standalone server never evaluates this file anyway.
// (Not @next/env: it caches its first load, which is Next's own of apps/web.
// Not --env-file: Next passes execArgv to child processes via NODE_OPTIONS,
// where that flag is not allowed.)
const envFile = path.join(monorepoRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image.
  output: "standalone",
  // The workspace packages live outside apps/web; trace and resolve from the root.
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
