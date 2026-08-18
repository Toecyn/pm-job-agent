import { defineConfig } from "vitest/config"
import path from "node:path"

const rootDir = import.meta.dirname

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./src/tests/globalSetup.ts"],
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000, // embedded Postgres init/start can take a while on first run
    // Integration tests share one SQLite file and mutate real tables — run
    // serially to avoid cross-test interference (see src/tests/setup.ts).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
})
