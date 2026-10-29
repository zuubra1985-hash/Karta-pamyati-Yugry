import { test } from "node:test";
import assert from "node:assert/strict";
import memories from "../server/data/memories.json" with { type: "json" };
import places from "../server/data/passports.json" with { type: "json" };
import { withMemories } from "../server/memories.mjs";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";

test("published memoirs have named narrators, traceable sources, brief excerpts and valid settlement links", () => {
  assert.equal(memories.length, 5);
  assert.equal(new Set(memories.map((m) => m.id)).size, memories.length);
  const ids = new Set(places.map((p) => p.id));
  for (const memory of memories) {
    assert.ok(memory.narrator.length > 10);
    assert.ok(memory.summary.length > 100);
    assert.ok(memory.placeIds.length > 0 && memory.placeIds.every((id) => ids.has(id)));
    assert.equal(new URL(memory.source.url).protocol, "https:");
    assert.ok(memory.source.title && memory.source.publisher);
    assert.ok(memory.quote.split(/\s+/).length <= 25);
    assert.match(memory.evidence.sha256, /^[a-f0-9]{64}$/);
    assert.equal(memory.evidence.quoteConfirmed, true);
  }
});
test("memoirs supplement only their actual settlement without exposing editorial evidence or modifying source data", () => {
  const source = places.find((p) => p.id === "pas-018");
  const publicPlace = withMemories(source);
  assert.equal(publicPlace.memories.length, 2);
  assert.ok(publicPlace.memories.every((m) => !Object.hasOwn(m, "evidence")));
  assert.equal(source.memories, undefined);
  assert.equal(withMemories({ id: "unrelated-story" }).memories.length, 0);
  const shared = memories.find((m) => m.narrator.includes("Показаньев"));
  assert.deepEqual(new Set(shared.placeIds), new Set(["pas-008", "pas-030"]));
});

test("production API publishes memoirs consistently and permits the Yandex frame without exposing editorial evidence", async () => {
  const store = new Store(":memory:");
  const server = createApp(store, { production: true }).listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/places`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-src https:\/\/yandex\.ru(?:;|$)/);
    const catalogue = await response.json();
    assert.equal(catalogue.length, 36);
    const published = catalogue.flatMap((place) => place.memories);
    assert.equal(new Set(published.map((memory) => memory.id)).size, 5);
    assert.ok(published.every((memory) => !Object.hasOwn(memory, "evidence")));
    const single = await (await fetch(`${base}/api/places/pas-018`)).json();
    assert.deepEqual(single.memories, catalogue.find((place) => place.id === single.id).memories);
    assert.equal(single.memories.length, 2);
    assert.equal((await fetch(`${base}/api/places/missing-place`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
});
