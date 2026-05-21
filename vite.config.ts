import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString())
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
