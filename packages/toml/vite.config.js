import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        "index": resolve(import.meta.dirname, "src/index.ts"),
        "json/index": resolve(import.meta.dirname, "src/json/index.ts"),
      },
      formats: ["es"],
    },
    rolldownOptions: {
      external: [
        /^@simple-api-stream\/core(\/.*)?$/,
        /^@simple-api-stream\/json(\/.*)?$/,
      ],
    },
  },
});
