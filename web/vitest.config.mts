import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The restart-census claims run a few hundred EM fits (about 1.5 s on CI); give
    // slow or busy machines plenty of headroom over vitest's 5 s default.
    testTimeout: 30_000,
  },
});
