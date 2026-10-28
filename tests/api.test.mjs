import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";

let store, server, base;
const input = {
  title: "История тестового места",
  location: "Сургут",
  category: "people",
  year: 1975,
  latitude: 61.24,
  longitude: 73.4,
  story: "Тестовое воспоминание. ".repeat(8),
  author: "Тестовый автор",
  contact: "private@example.invalid",
  source: "Личный рассказ, тестовая запись",
  consent: true,
};
const png = {
  type: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=",
};
before(async () => {
  store = new Store(":memory:");
  store.createAdmin("editor@example.invalid", "test-only-long-password-123");
  server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  store.close();
});
const request = (path, body, cookie, extra = {}) =>
  fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
function editorCookie() {
  return `memory_session=${store.login("editor@example.invalid", "test-only-long-password-123")}`;
}

test("public archive labels every seeded example and never exposes contacts", async () => {
  const response = await request("/api/places");
  assert.equal(response.status, 200);
  const places = await response.json();
  assert.equal(places.length, 8);
  assert.ok(places.every((p) => p.demo === true && !("contact" in p)));
});
test("submission remains private until authenticated moderation; approved contact stays private", async () => {
  const submitted = await request("/api/submissions", { ...input, photo: png });
  assert.equal(submitted.status, 201);
  const { id } = await submitted.json();
  assert.equal((await request(`/api/places/${id}`)).status, 404);
  const submission = store.submissions().find((p) => p.id === id);
  assert.equal((await request(`/api/media/${submission.mediaId}`)).status, 404);
  assert.equal((await request("/api/admin/submissions")).status, 401);
  assert.equal(
    (await request(`/api/admin/submissions/${id}`, { action: "approve" }))
      .status,
    401,
  );
  const cookie = editorCookie();
  assert.equal(
    (await request(`/api/media/${submission.mediaId}`, undefined, cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        `/api/admin/submissions/${id}`,
        { action: "approve" },
        cookie,
      )
    ).status,
    200,
  );
  const published = await (await request(`/api/places/${id}`)).json();
  assert.equal(published.demo, false);
  assert.equal(published.story, input.story.trim());
  assert.ok(!("contact" in published));
  assert.ok(!("consent" in published));
  const image = await request(`/api/media/${submission.mediaId}`);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    (
      await request(
        `/api/admin/submissions/${id}`,
        { action: "approve" },
        cookie,
      )
    ).status,
    409,
  );
});
test("rejected material and image never appear in public archive", async () => {
  const { id } = await (
    await request("/api/submissions", { ...input, photo: png })
  ).json();
  const item = store.submissions().find((p) => p.id === id);
  assert.equal(
    (
      await request(
        `/api/admin/submissions/${id}`,
        { action: "reject", reason: "Нужен источник" },
        editorCookie(),
      )
    ).status,
    200,
  );
  assert.equal((await request(`/api/places/${id}`)).status, 404);
  assert.equal((await request(`/api/media/${item.mediaId}`)).status, 404);
});
test("server validates consent, text length, coordinates and image content", async () => {
  for (const overrides of [
    { consent: false },
    { story: "Коротко" },
    { latitude: 90 },
    { longitude: 200 },
    { category: "admin" },
    { year: 9999 },
    { photo: { ...png, type: "image/jpeg" } },
  ]) {
    assert.equal(
      (await request("/api/submissions", { ...input, ...overrides })).status,
      400,
    );
  }
});
test("cross-site mutations are rejected, including with an authenticated cookie", async () => {
  assert.equal(
    (
      await request("/api/admin/logout", {}, editorCookie(), {
        Origin: "https://elsewhere.invalid",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/submissions", input, undefined, {
        "Sec-Fetch-Site": "cross-site",
      })
    ).status,
    403,
  );
});
test("admin login uses an HttpOnly SameSite cookie, rejects invalid credentials and revokes logout", async () => {
  assert.equal(
    (
      await request("/api/admin/login", {
        email: "editor@example.invalid",
        password: "wrong",
      })
    ).status,
    401,
  );
  const login = await request("/api/admin/login", {
    email: "editor@example.invalid",
    password: "test-only-long-password-123",
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(";")[0];
  assert.equal(
    (await request("/api/admin/session", undefined, cookie)).status,
    200,
  );
  assert.equal((await request("/api/admin/logout", {}, cookie)).status, 200);
  assert.equal(
    (await request("/api/admin/session", undefined, cookie)).status,
    401,
  );
  assert.equal(
    (await request("/api/admin/session", undefined, "memory_session=forged"))
      .status,
    401,
  );
});
test("database survives restart; setup does not duplicate demo content", () => {
  const directory = mkdtempSync(join(tmpdir(), "yugra-memory-"));
  try {
    const path = join(directory, "db.sqlite");
    const original = new Store(path);
    const id = original.submit(input);
    original.close();
    const restored = new Store(path);
    assert.equal(restored.places().length, 8);
    assert.equal(restored.submissions()[0].id, id);
    restored.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("production session cookies are Secure and there are no default admin credentials", async () => {
  const fresh = new Store(":memory:", { seed: false });
  assert.equal(fresh.login("admin@example.invalid", "110985"), null);
  assert.throws(() => fresh.createAdmin("test@example.invalid", "short"));
  fresh.createAdmin("editor@example.invalid", "test-only-long-password-123");
  const production = createApp(fresh, { production: true }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((resolve) => production.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${production.address().port}/api/admin/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "editor@example.invalid",
          password: "test-only-long-password-123",
        }),
      },
    );
    assert.match(response.headers.get("set-cookie"), /Secure/);
    assert.ok(
      response.headers
        .get("content-security-policy")
        .includes("script-src 'self'"),
    );
  } finally {
    await new Promise((resolve) => production.close(resolve));
    fresh.close();
  }
});
