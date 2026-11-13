import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { isIP } from "node:net";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const port = Number(process.env.PORT ?? "8081");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const basePath = process.env.BASE_PATH ?? "/__mockup";
if (!basePath.startsWith("/") || basePath.startsWith("//") || /[?#\\]/.test(basePath)) {
  throw new Error("BASE_PATH must be an absolute application path.");
}

const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const host = process.env.HOST?.trim() || "127.0.0.1";
if (!isIP(host) && !hostnamePattern.test(host)) {
  throw new Error("HOST must be an IP address or an exact hostname.");
}

const allowedHosts = (process.env.ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (allowedHosts.some((value) => !isIP(value) && !hostnamePattern.test(value))) {
  throw new Error("ALLOWED_HOSTS must contain exact hostnames separated by commas.");
}
if (!isIP(host)) allowedHosts.push(host);
if (process.env.PUBLIC_URL) {
  const publicUrl = new URL(process.env.PUBLIC_URL);
  if (!["http:", "https:"].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password) {
    throw new Error("PUBLIC_URL must be an HTTP or HTTPS URL without credentials.");
  }
  allowedHosts.push(publicUrl.hostname);
}

const apiTarget = new URL(process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000");
if (!["http:", "https:"].includes(apiTarget.protocol) || apiTarget.username || apiTarget.password) {
  throw new Error("API_PROXY_TARGET must be an HTTP or HTTPS URL without credentials.");
}
const apiProxy = {
  target: apiTarget.toString(),
  changeOrigin: false,
  ws: true,
};

export default defineConfig({
  base: basePath,
  plugins: [mockupPreviewPlugin(), react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": apiProxy },
    port,
    strictPort: true,
    host,
    allowedHosts: [...new Set(allowedHosts)],
    fs: { strict: true },
  },
  preview: {
    proxy: { "/api": apiProxy },
    port,
    strictPort: true,
    host,
    allowedHosts: [...new Set(allowedHosts)],
  },
});
