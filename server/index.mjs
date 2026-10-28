import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createHttpServer } from 'node:http';
import { Store } from "./store.mjs";
import { createApp } from "./app.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.NODE_ENV === "production";
export const databasePath =
  process.env.MEMORY_DB || resolve(root, "data/memory.sqlite");
const store = new Store(databasePath);
const app = createApp(store, { production, origin: process.env.APP_ORIGIN });
const server = createHttpServer(app);
let vite;
if (production) {
  app.use(express.static(resolve(root, "dist")));
  app.get("*", (_, res) => res.sendFile(resolve(root, "dist/index.html")));
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3100);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Карта памяти Югры: порт ${port} (${production ? "production" : "development"})`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(async () => {
      await vite?.close();
      store.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
