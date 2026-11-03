import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5180, proxy: { "/api": "http://127.0.0.1:8787" } },
  preview: { port: 5181, proxy: { "/api": "http://127.0.0.1:8787" } },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.ts"] },
});
