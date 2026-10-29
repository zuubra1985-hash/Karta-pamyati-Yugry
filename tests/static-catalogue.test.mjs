import { test } from "node:test";
import assert from "node:assert/strict";
import { loadArchive } from "../src/archive.ts";
import passports from "../server/data/passports.json" with { type: "json" };

test("static hosting loads all 36 passports when the API is missing or returns the SPA shell", async () => {
  for (const status of [404, 200, 503]) {
    const requests = [];
    const archive = await loadArchive(async (url) => {
      requests.push(url);
      return url === "/api/places"
        ? new Response("<!doctype html><div id='root'></div>", {
            status, headers: { "content-type": "text/html" },
          })
        : Response.json(passports);
    });
    assert.equal(archive.mode, "catalogue");
    assert.equal(archive.places.length, 36);
    assert.ok(archive.places.every((p) => p.verificationStatus === "verified"));
    assert.deepEqual(requests, ["/api/places", "/catalogue/places.json"]);
  }
});

test("an available server remains authoritative, including an intentionally empty archive", async () => {
  for (const places of [[], passports.slice(0, 2)]) {
    const requests = [];
    const archive = await loadArchive(async (url) => {
      requests.push(url);
      return Response.json(places);
    });
    assert.equal(archive.mode, "server");
    assert.deepEqual(archive.places, places);
    assert.deepEqual(requests, ["/api/places"]);
  }
});

test("a failed API connection or malformed API response still opens the published catalogue", async () => {
  for (const failure of ["network", "shape"]) {
    const archive = await loadArchive(async (url) => {
      if (url === "/api/places") {
        if (failure === "network") throw new TypeError("Failed to fetch");
        return Response.json({ error: "Not a place list" });
      }
      return Response.json(passports);
    });
    assert.equal(archive.mode, "catalogue");
    assert.equal(archive.places.length, 36);
  }
});

test("a missing or malformed catalogue reports a readable error instead of displaying zero objects", async () => {
  for (const result of ["html", "shape", "json"]) {
    await assert.rejects(loadArchive(async () => {
      if (result === "shape") return Response.json([null]);
      return new Response(result === "html" ? "<html>404</html>" : "broken json", {
        headers: { "content-type": result === "html" ? "text/html" : "application/json" },
      });
    }), /Не удалось загрузить паспорта/);
  }
});
