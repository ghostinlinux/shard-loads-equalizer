import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 900000,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Run Tests With Shard Loads Equalizer",
      use: { channel: "chrome" },
      testDir: "./tests",
    },
  ],
});
