import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";

const png = {
  type: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=",
};
const original = {
  title: "Двор моей школы в Сургуте",
  location: "Сургут",
  category: "architecture",
  year: 1975,
  latitude: 61.24,
  longitude: 73.4,
  story: "Первоначальное воспоминание автора. ".repeat(6),
  author: "Автор истории",
  source: "Семейный архив, разрешение автора",
  contact: "private-v2@example.invalid",
  consent: true,
};
const pair = {
  ...original,
  photo: png,
  afterPhoto: png,
  afterYear: 2020,
  afterSource: "Фотография участника, разрешение получено",
};
const fields = (data) => {
  const {
    title,
    location,
    category,
    year,
    latitude,
    longitude,
    story,
    author,
    source,
    afterYear,
    afterSource,
  } = data;
  return {
    title,
    location,
    category,
    year,
    latitude,
    longitude,
    story,
    author,
    source,
    afterYear,
    afterSource,
  };
};
async function fixture(run) {
  const store = new Store(":memory:", { catalogue: false });
  store.createAdmin("editor@example.invalid", "editor-test-password-only");
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = `memory_session=${store.login("editor@example.invalid", "editor-test-password-only")}`;
  const request = (url, { body, admin = false, method } = {}) =>
    fetch(base + url, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        ...(admin ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await run({ store, request });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
}
test("both comparison images are private until approval; attribution survives publication", () =>
  fixture(async ({ store, request }) => {
    const response = await request("/api/submissions", { body: pair });
    assert.equal(response.status, 201);
    const { id } = await response.json();
    const item = store.submission(id);
    for (const image of [item.mediaId, item.afterMediaId]) {
      assert.equal((await request(`/api/media/${image}`)).status, 404);
      assert.equal(
        (await request(`/api/media/${image}`, { admin: true })).status,
        200,
      );
    }
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "approve", revision: 0 },
        })
      ).status,
      200,
    );
    const published = await (await request(`/api/places/${id}`)).json();
    assert.equal(published.afterYear, 2020);
    assert.equal(published.afterSource, pair.afterSource);
    assert.equal(published.afterMediaId, item.afterMediaId);
    assert.ok(!("contact" in published));
    assert.equal(
      (await request(`/api/media/${item.afterMediaId}`)).status,
      200,
    );
  }));
test("invalid photo pairs fail atomically without saving files or submissions", () =>
  fixture(async ({ store, request }) => {
    for (const patch of [
      { photo: undefined },
      { afterYear: undefined },
      { afterSource: undefined },
      { afterYear: 1900 },
      { afterPhoto: undefined },
      { afterPhoto: { ...png, type: "image/jpeg" } },
    ]) {
      assert.equal(
        (await request("/api/submissions", { body: { ...pair, ...patch } }))
          .status,
        400,
      );
    }
    assert.equal(store.submissions().length, 0);
    assert.equal(store.db.prepare("SELECT count(*) n FROM media").get().n, 0);
  }));
test("an editor can correct a draft, preserve its original, and publish only the current revision", () =>
  fixture(async ({ store, request }) => {
    const { id } = await (
      await request("/api/submissions", { body: pair })
    ).json();
    const update = {
      ...fields(pair),
      title: "Уточнённая история школьного двора",
      year: 1976,
      source: "Архивная подпись проверена редактором",
      revision: 0,
    };
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          method: "PATCH",
          body: update,
        })
      ).status,
      401,
    );
    assert.equal(
      (await request(`/api/admin/submissions/${id}/history`)).status,
      401,
    );
    const saved = await request(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      admin: true,
      body: update,
    });
    assert.equal(saved.status, 200);
    const data = await saved.json();
    assert.equal(data.revision, 1);
    assert.equal(data.contact, original.contact);
    assert.equal(data.consent, true);
    assert.equal(store.submission(id).mediaId !== undefined, true);
    assert.equal((await request(`/api/places/${id}`)).status, 404);
    const history = await (
      await request(`/api/admin/submissions/${id}/history`, { admin: true })
    ).json();
    assert.equal(history.length, 1);
    assert.equal(history[0].before.title, original.title);
    assert.equal(history[0].after.title, update.title);
    assert.equal(history[0].editor, "editor@example.invalid");
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          method: "PATCH",
          admin: true,
          body: { ...update, title: "Устаревшая правка" },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "approve", revision: 0 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "approve", revision: 1 },
        })
      ).status,
      200,
    );
    const published = await (await request(`/api/places/${id}`)).json();
    assert.equal(published.title, update.title);
    assert.equal(published.year, 1976);
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          method: "PATCH",
          admin: true,
          body: { ...update, revision: 2 },
        })
      ).status,
      409,
    );
  }));
test("editorial changes cannot alter contact, consent, media ownership or publication state", () =>
  fixture(async ({ store, request }) => {
    const { id } = await (
      await request("/api/submissions", { body: original })
    ).json();
    for (const extra of [
      { contact: "other@example.invalid" },
      { consent: false },
      { mediaId: "another-file" },
      { afterMediaId: "another-file" },
      { status: "approved" },
      { demo: true },
      { year: 3000 },
    ])
      assert.equal(
        (
          await request(`/api/admin/submissions/${id}`, {
            method: "PATCH",
            admin: true,
            body: { ...fields(original), revision: 0, ...extra },
          })
        ).status,
        400,
      );
    assert.equal(store.submission(id).revision, 0);
    assert.equal(store.editHistory(id).length, 0);
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "reject" },
        })
      ).status,
      400,
    );
  }));
test("additive migration retains v1 submissions, approved data, and deleted demo choices", () => {
  const dir = mkdtempSync(join(tmpdir(), "memory-v1-"));
  const path = join(dir, "legacy.sqlite");
  try {
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE submissions(id TEXT PRIMARY KEY,status TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,reason TEXT); CREATE TABLE places(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
    );
    db.prepare("INSERT INTO submissions VALUES (?, ?, ?, ?, ?)").run(
      "legacy",
      "pending",
      JSON.stringify(original),
      "2026-01-01",
      null,
    );
    db.prepare("INSERT INTO places VALUES (?, ?)").run(
      "kept",
      JSON.stringify({ ...original, id: "kept", demo: false }),
    );
    db.prepare("INSERT INTO metadata VALUES (?, ?)").run("seed_v1", "done");
    db.close();
    let migrated = new Store(path, { catalogue: false });
    assert.equal(migrated.submission("legacy").revision, 0);
    assert.equal(migrated.submission("legacy").story, original.story);
    assert.equal(migrated.places().length, 1);
    assert.equal(migrated.place("kept").demo, false);
    migrated.revise(
      "legacy",
      { title: "Исправленный старый материал" },
      0,
      "editor@example.invalid",
    );
    migrated.close();
    migrated = new Store(path, { catalogue: false });
    assert.equal(migrated.submission("legacy").revision, 1);
    assert.equal(
      migrated.editHistory("legacy")[0].before.story,
      original.story,
    );
    assert.equal(migrated.places().length, 1);
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("rejection keeps both images private and demo comparison is explicitly an illustration", () =>
  fixture(async ({ store, request }) => {
    const { id } = await (
      await request("/api/submissions", { body: pair })
    ).json();
    const item = store.submission(id);
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "reject", revision: 0, reason: "Нужны разрешения" },
        })
      ).status,
      200,
    );
    for (const media of [item.mediaId, item.afterMediaId])
      assert.equal((await request(`/api/media/${media}`)).status, 404);
    const demo = store.place("old-surgut");
    assert.equal(demo.demo, true);
    assert.equal(demo.afterImage, "village-now");
    assert.ok(demo.afterSource.includes("иллюстрация"));
  }));
test("structured object passport survives review and publication without fabricating missing fields", () =>
  fixture(async ({ store, request }) => {
    const passport = {
      documentTitle: "Тестовый паспорт объекта",
      officialName: "Тестовый объект",
      objectType: "Здание",
      period: "1970-е годы",
      documentUrl: "https://example.org/archive/passport",
      archiveReference: "Фонд ТЕСТ, страница 2",
    };
    const response = await request("/api/submissions", {
      body: { ...original, passport },
    });
    assert.equal(response.status, 201);
    const { id } = await response.json();
    assert.deepEqual(store.submission(id).passport, passport);
    const update = {
      ...fields(original),
      passport: {
        ...passport,
        condition: "Состояние уточнено по тестовому документу",
      },
      revision: 0,
    };
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          method: "PATCH",
          admin: true,
          body: update,
        })
      ).status,
      200,
    );
    assert.deepEqual(store.editHistory(id)[0].before.passport, passport);
    assert.equal(
      (
        await request(`/api/admin/submissions/${id}`, {
          admin: true,
          body: { action: "approve", revision: 1 },
        })
      ).status,
      200,
    );
    const published = await (await request(`/api/places/${id}`)).json();
    assert.equal(published.passport.documentTitle, passport.documentTitle);
    assert.equal(published.passport.condition, update.passport.condition);
    assert.ok(!("protectionStatus" in published.passport));
    assert.ok(!("contact" in published));
  }));
test("passport source URLs must be valid HTTPS without credentials; personal fields are not accepted", () =>
  fixture(async ({ store, request }) => {
    for (const passport of [
      { documentTitle: "Тестовый источник", documentUrl: "not a URL" },
      {
        documentTitle: "Тестовый источник",
        documentUrl: "javascript:alert(1)",
      },
      { documentTitle: "Тестовый источник", documentUrl: "http://example.org" },
      {
        documentTitle: "Тестовый источник",
        documentUrl: "https://user:password@example.org",
      },
      { documentTitle: "Тестовый источник", privatePhone: "test" },
      { officialName: "Нет названия источника" },
    ])
      assert.equal(
        (await request("/api/submissions", { body: { ...original, passport } }))
          .status,
        400,
      );
    assert.equal(store.submissions().length, 0);
  }));
