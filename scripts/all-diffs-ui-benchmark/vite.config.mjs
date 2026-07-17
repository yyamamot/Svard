import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const benchmarkDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(benchmarkDirectory, "../..");
const benchmarkOutDir = path.join(
  repositoryRoot,
  ".artifacts/perf/imp-445-all-diffs-ui-bundle",
);

export default defineConfig(({ command }) => ({
  root: repositoryRoot,
  plugins: [react()],
  define: {
    __SVARD_ALL_DIFFS_UI_PRODUCTION_BUNDLE__: JSON.stringify(
      command === "build",
    ),
  },
  build: {
    emptyOutDir: true,
    outDir: benchmarkOutDir,
    rolldownOptions: {
      input: path.join(repositoryRoot, "scripts/all-diffs-ui-benchmark.html"),
    },
  },
  preview: {
    host: "127.0.0.1",
    strictPort: true,
  },
}));
