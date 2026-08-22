import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDirectory,
  build: {
    emptyOutDir: true,
    outDir: resolve(
      currentDirectory,
      "../../.artifacts/mermaid-isolation/site",
    ),
    rollupOptions: {
      input: resolve(currentDirectory, "index.html"),
    },
  },
});
