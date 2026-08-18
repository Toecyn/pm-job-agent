import { defineConfig } from "vitest/config"
import path from "node:path"

const rootDir = import.meta.dirname

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
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
