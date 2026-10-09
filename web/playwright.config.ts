/**
 * Playwright drives the guided tour (e2e/showcase.spec.ts): it checks the main journeys end to end
 * and, on the way, captures the README screenshots and the /tour recordings. Run it with
 * `pnpm showcase` (see scripts/showcase.mjs).
 *
 * - BASE_URL picks the site (default: production). A localhost URL starts `pnpm start` on that
 *   port first, so run `pnpm build` before using it.
 * - The system Google Chrome is used (channel "chrome"); no browser is downloaded.
 */
import { defineConfig } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL ?? "https://em-algorithm-lab.vercel.app").replace(/\/$/, "");
const target = new URL(BASE_URL);
const isLocal = ["localhost", "127.0.0.1"].includes(target.hostname);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 6 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    headless: true,
    locale: "en-AU",
    timezoneId: "Australia/Adelaide",
    reducedMotion: "no-preference",
    // fail fast on a missing element instead of waiting out the whole test
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  webServer: isLocal
    ? {
        command: `pnpm start --port ${target.port || "3000"}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
