import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "published-passport-catalogue",
      generateBundle() {
        // This curated source contains public passports only, never SQLite data.
        this.emitFile({
          type: "asset",
          fileName: "catalogue/places.json",
          source: readFileSync(
            new URL("./server/data/passports.json", import.meta.url),
            "utf8",
          ),
        });
      },
    },
  ],
  build: { chunkSizeWarningLimit: 700 },
});
