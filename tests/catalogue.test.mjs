import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import manifest from "../server/data/passport-sources.json" with { type: "json" };
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
      35,
    );
    assert.equal(places.filter((p) => p.year === null).length, 12);
    assert.equal(store.place("pas-029").latitude, null);
    assert.equal(store.place("pas-029").longitude, null);
    assert.ok(places.every((p) => p.passport.references.length > 0));
    assert.ok(
      store.place("pas-005").passport.period.includes("№ 229-оз не подходит"),
    );
    assert.ok(
      store.place("pas-001").passport.period.includes("№ 92-оз ошибочен"),
    );
    for (const id of ["pas-012", "pas-022", "pas-026", "pas-030"])
      assert.ok(
        store.place(id).passport.historicalStatus.includes("Действующий"),
      );
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
    assert.equal(db.place("pas-002").year, null);
    assert.equal(db.place("pas-036"), null);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
