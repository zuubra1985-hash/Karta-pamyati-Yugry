import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const staticCatalogueAllowed = process.env.VERCEL !== "1" && process.env.ARCHIVE_DEPLOYMENT_MODE !== "server";
export default defineConfig({
  define: { __STATIC_CATALOGUE_ALLOWED__: JSON.stringify(staticCatalogueAllowed) },
  plugins: [
    react(),
    {
      name: "published-passport-catalogue",
      generateBundle() {
        if (!staticCatalogueAllowed) return;
        const places = JSON.parse(readFileSync(new URL("./server/data/passports.json", import.meta.url), "utf8"));
        const memories = JSON.parse(readFileSync(new URL("./server/data/memories.json", import.meta.url), "utf8"));
        const contexts = JSON.parse(readFileSync(new URL("./server/data/historical-contexts.json", import.meta.url), "utf8"));
        // This curated source contains public passports only, never SQLite data.
        this.emitFile({
          type: "asset",
          fileName: "catalogue/places.json",
          source: JSON.stringify(places.map((place: { id: string }) => ({ ...place, ...(contexts[place.id] ? {historicalContext: contexts[place.id]} : {}), memories: memories.filter((memory: { placeIds: string[] }) => memory.placeIds.includes(place.id)).map(({ evidence, ...memory }: { evidence: unknown }) => memory) }))),
        });
      },
    },
  ],
  build: { chunkSizeWarningLimit: 700 },
});
