// @ts-check
import path from "node:path";
import { fixupConfigRules } from "@eslint/compat";
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

// The React, a11y and import plugins inside eslint-config-next still call
// context methods that ESLint 10 removed; fixupConfigRules shims them. It wraps
// the whole config because a plugin always gets the same wrapper — wrapping
// only the Next part would leave two different @typescript-eslint objects.
// Drop it once those plugins support ESLint 10.
export default fixupConfigRules(
  defineConfig([
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
          projectService: {
            // Config files at the root belong to no package's tsconfig.
            allowDefaultProject: ["*.config.ts"],
            defaultProject: "tsconfig.base.json",
          },
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
      settings: { next: { rootDir: path.join(import.meta.dirname, "apps/web") } },
      rules: {
        // Pages Router only; the app has none.
        "@next/next/no-html-link-for-pages": "off",
      },
    },

    {
      files: ["**/*.js"],
      extends: [js.configs.recommended],
    },

    // Last: switch off every stylistic rule that would fight Prettier.
    prettier,
  ]),
);
