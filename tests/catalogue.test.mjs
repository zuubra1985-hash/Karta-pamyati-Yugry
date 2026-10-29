import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import manifest from "../server/data/passport-sources.json" with { type: "json" };
import review from "../server/data/passport-review.json" with { type: "json" };
test("all 36 source passports have unique identities and owner-confirmed verified status", () => {
  const store = new Store(":memory:");
  try {
    const places = store.places();
    assert.equal(places.length, 36);
    assert.equal(new Set(places.map((p) => p.id)).size, 36);
    assert.ok(
      places.every(
        (p) =>
          p.demo === false &&
          p.verificationStatus === "verified" &&
          p.verification.by === "project_owner" &&
          p.verification.confirmedOn === "2026-10-29" &&
          p.passport.documentTitle === manifest.sourceFile &&
          p.story.length > 80,
      ),
    );
    assert.equal(
      places.filter((p) => p.coordinateStatus === "hypothesis").length,
      32,
    );
    assert.equal(places.filter((p) => p.year === null).length, 6);
    assert.equal(store.place("pas-029").latitude, null);
    assert.equal(store.place("pas-029").longitude, null);
    assert.ok(places.every((p) => p.passport.references.length > 0));
    assert.doesNotMatch(store.place("pas-005").passport.period, /229-оз/);
    assert.equal(store.place("pas-011").year, 1931);
    assert.equal(store.place("pas-018").year, 1932);
    assert.equal(store.place("pas-024").year, 1931);
    assert.match(store.place("pas-036").passport.period, /середине 1930-х/);
    for (const id of ["pas-012", "pas-022", "pas-026", "pas-030"])
      assert.ok(
        store.place(id).passport.historicalStatus.includes("Действующий"),
      );
  } finally {
    store.close();
  }
});
test("online review updates imported fields once, preserves owner edits and never restores deleted objects", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-online-review-"));
  const path = join(dir, "db.sqlite");
  try {
    let store = new Store(path);
    const place = store.place("pas-013");
    // The original source used 1930; the museum's dated history now uses 1934.
    place.year = 1930;
    place.story = "Собственная редакторская правка владельца";
    store.db.prepare("UPDATE places SET data=? WHERE id=?").run(JSON.stringify(place), place.id);
    store.db.prepare("DELETE FROM places WHERE id=?").run("pas-036");
    store.db.prepare("DELETE FROM metadata WHERE key=?").run(review.id);
    store.close();
    store = new Store(path);
    assert.equal(store.place("pas-013").year, 1934);
    assert.equal(store.place("pas-013").story, place.story);
    assert.equal(store.place("pas-036"), null);
    const edited = { ...store.place("pas-013"), year: 1955 };
    store.db.prepare("UPDATE places SET data=? WHERE id=?").run(JSON.stringify(edited), edited.id);
    store.close();
    store = new Store(path);
    assert.equal(store.place("pas-013").year, 1955);
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("every passport has an honest review record and all published web citations have a recorded source", () => {
  const store = new Store(":memory:");
  try {
    const places = store.places();
    assert.deepEqual(new Set(review.places.map((p) => p.id)), new Set(places.map((p) => p.id)));
    assert.equal(review.places.find((p) => p.id === "pas-020").coverage, "owner_source_only");
    assert.equal(review.places.find((p) => p.id === "pas-025").coverage, "identity_unresolved");
    for (const place of places) {
      const entry = review.places.find((p) => p.id === place.id);
      for (const key of entry.sourceIds) assert.ok(review.sources[key]);
      for (const citation of place.passport.webSources) {
        const url = new URL(citation.url);
        assert.equal(url.protocol, "https:");
        assert.equal(url.username + url.password, "");
        assert.ok(Object.values(review.sources).some((source) => source.url === citation.url));
      }
      if (place.coordinateStatus === "unknown") {
        assert.equal(place.latitude, null);
        assert.equal(place.longitude, null);
      }
    }
    assert.match(store.place("pas-034").passport.population, /Ямской вместе/);
    assert.match(store.place("pas-036").passport.population, /Сухой вместе/);
    assert.match(store.place("pas-003").story, /другой населённый пункт/);
    assert.match(store.place("pas-028").passport.period, /1926/);
  } finally {
    store.close();
  }
});
test("catalogue upgrade preserves user publications, submissions and source edits without duplicating records", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-catalogue-"));
  const path = join(dir, "db.sqlite");
  try {
    let db = new Store(path, { catalogue: false });
    db.db.prepare("INSERT INTO places VALUES (?,?)").run(
      "user-existing",
      JSON.stringify({
        id: "user-existing",
        demo: false,
        title: "Существующая публикация",
      }),
    );
    db.close();
    db = new Store(path);
    assert.equal(db.places().length, 37);
    assert.equal(db.place("user-existing").title, "Существующая публикация");
    const corrected = {
      ...db.place("pas-001"),
      summary: "Уточнение владельца",
    };
    db.db
      .prepare("UPDATE places SET data=? WHERE id=?")
      .run(JSON.stringify(corrected), "pas-001");
    db.close();
    db = new Store(path);
    assert.equal(db.places().length, 37);
    assert.equal(db.place("pas-001").summary, "Уточнение владельца");
    assert.equal(
      db.db.prepare("SELECT count(*) n FROM places WHERE id LIKE 'pas-%'").get()
        .n,
      36,
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("owner confirmation upgrades an existing catalogue without overwriting edits or inventing dates and coordinates", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-confirmed-"));
  const path = join(dir, "db.sqlite");
  try {
    let db = new Store(path);
    const original = db.place("pas-029");
    const legacy = {
      ...original,
      verificationStatus: "working",
      summary: "Правка владельца, которую нужно сохранить",
      story: "Текст, отредактированный владельцем",
      source: "Собственная подпись источника",
    };
    delete legacy.verification;
    db.db
      .prepare("UPDATE places SET data=? WHERE id=?")
      .run(JSON.stringify(legacy), legacy.id);
    db.db.prepare("DELETE FROM places WHERE id=?").run("pas-036");
    db.db
      .prepare("DELETE FROM metadata WHERE key=?")
      .run("surgut_passports_owner_verified_20261029");
    db.close();
    db = new Store(path);
    const updated = db.place("pas-029");
    assert.equal(updated.verificationStatus, "verified");
    assert.deepEqual(updated.verification, {
      by: "project_owner",
      confirmedOn: "2026-10-29",
    });
    assert.equal(updated.summary, legacy.summary);
    assert.equal(updated.story, legacy.story);
    assert.equal(updated.source, legacy.source);
    assert.deepEqual(updated.passport, original.passport);
    assert.equal(updated.latitude, null);
    assert.equal(updated.longitude, null);
    assert.equal(db.place("pas-002").year, 2009);
    assert.equal(db.place("pas-036"), null);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
