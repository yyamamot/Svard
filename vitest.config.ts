import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["Arto/**", "test/e2e/**", "node_modules/**", "dist/**"],
    globals: false,
  },
});
