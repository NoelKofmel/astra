import { defineConfig } from "vitest/config";

// Every package's tests in one run: `pnpm test`, or `pnpm test:coverage` for
// the report SonarQube imports (sonar-project.properties). Narrow it down with
// `pnpm test --project @astra/worker`.
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Every source file, tested or not — untested code must show up as such.
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
