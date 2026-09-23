// @ts-check
import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// One config for the whole monorepo. The conventions in docs/07-conventions.md
// are enforced here wherever a rule can express them.

/** Modules allowed to read process.env — see "Configuration and secrets". */
const envReaders = [
  "apps/web/src/config.ts",
  "apps/worker/src/config.ts",
  // Next.js plumbing: register() must check NEXT_RUNTIME.
  "apps/web/src/instrumentation.ts",
  // Standalone CLI entry point with its own one-variable config.
  "packages/db/src/migrate.ts",
  // Tooling configuration, not application code.
  "**/*.config.ts",
];
const useTypedConfig =
  "Import the typed config instead (docs/07-conventions.md#configuration-and-secrets).";

export default defineConfig([
  globalIgnores(["**/.next/", "**/.turbo/", "**/coverage/", "**/next-env.d.ts"]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Logging: one logger from @astra/core, never console.*
      "no-console": "error",

      // Configuration: environment variables are read in exactly one module per app.
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: useTypedConfig },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: ["process", "node:process"].map((name) => ({
            name,
            importNames: ["env"],
            message: useTypedConfig,
          })),
        },
      ],

      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  {
    files: envReaders,
    rules: { "no-restricted-properties": "off" },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [nextVitals],
    settings: { next: { rootDir: "apps/web/" } },
  },

  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
  },

  // Last: switch off every stylistic rule that would fight Prettier.
  prettier,
]);
