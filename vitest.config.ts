import { resolve } from "path";
import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@simple-api-stream/core",
        replacement: resolve(import.meta.dirname, "packages/core/src/index.ts"),
      },
      {
        find: "@simple-api-stream/json",
        replacement: resolve(import.meta.dirname, "packages/json/src/index.ts"),
      },
      {
        find: "@simple-api-stream/xml",
        replacement: resolve(import.meta.dirname, "packages/xml/src/index.ts"),
      },
      {
        find: "@simple-api-stream/csv",
        replacement: resolve(import.meta.dirname, "packages/csv/src/index.ts"),
      },
    ],
  },
  test: {
    coverage: {
      reporter: ["cobertura", "text", "json-summary", "json"],
      reportsDirectory: "./TestResults/coverage",
      exclude: [
        ...coverageConfigDefaults.exclude,
        "utils/**/*.ts",
        "packages/*/vite.config.js",
      ],
    },
  },
});
