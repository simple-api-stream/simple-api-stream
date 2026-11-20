import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
      },
      formats: ["es"],
    },
  },
});
