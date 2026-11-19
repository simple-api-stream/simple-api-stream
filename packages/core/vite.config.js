import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        "index": resolve(import.meta.dirname, "src/index.ts"),
        "utils/index": resolve(import.meta.dirname, "src/utils/index.ts"),
      },
      formats: ["es"],
    },
  },
});
