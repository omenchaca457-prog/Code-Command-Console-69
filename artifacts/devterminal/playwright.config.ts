import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const chromiumPath =
  process.env.CHROMIUM_PATH ??
  (existsSync("/repl/tools/bin/chromium")
    ? "/repl/tools/bin/chromium"
    : undefined);

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4176",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  webServer: {
    command: "pnpm --filter @workspace/devterminal run dev",
    url: "http://127.0.0.1:4176",
    env: {
      PORT: "4176",
      BASE_PATH: "/",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
