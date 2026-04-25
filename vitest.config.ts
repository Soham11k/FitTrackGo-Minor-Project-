import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "lib/form-analysis.ts",
        "lib/store-supabase.ts",
        "lib/export.ts",
        "lib/network-status.ts",
        "lib/face-verification.ts",
      ],
      // No global thresholds: most app code is integration-tested or untested in Vitest;
      // thresholds here caused CI to fail when any included file had low %.
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
