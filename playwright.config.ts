import { defineConfig, devices } from "@playwright/test"
import { baseOf, SITES } from "./tests/sites.ts"

const browsers = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
}

export default defineConfig({
  testDir: "./tests",
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: { trace: "on-first-retry" },
  projects: [
    { name: "unit", testMatch: "unit/**/*.spec.ts" },
    ...Object.values(SITES).flatMap((site) =>
      Object.entries(browsers).map(([browser, device]) => ({
        name: `${site.name}-${browser}`,
        testIgnore: "unit/**",
        metadata: { site: site.name },
        use: { ...device, baseURL: `http://127.0.0.1:${site.port}` },
      })),
    ),
  ],
  webServer: Object.values(SITES).map((site) => ({
    command: `node scripts/build.mjs ${site.dir} && pnpm exec astro preview --root ${site.dir} --host 127.0.0.1 --port ${site.port}`,
    url: `http://127.0.0.1:${site.port}${baseOf(site)}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  })),
})
