import { chromium } from "playwright";
import express from "express";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

// Deliberately no Store and no API: reproduce a Vite-only Vercel deployment.
const app = express();
const writes = [];
app.use((req, res, next) => {
  if (req.method !== "GET") {
    writes.push(req.path);
    return res.sendStatus(405);
  }
  next();
});
app.use(express.static(resolve("dist")));
app.get("*", (_, res) => res.sendFile(resolve("dist/index.html")));
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.route("https://*.tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMWQAAAAASUVORK5CYII=", "base64") }));
await page.route("https://yandex.ru/map-widget/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Map provider stub for repeatable UI tests</body></html>" }));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const passed = [];
try {
  const published = JSON.parse(readFileSync("dist/catalogue/places.json", "utf8"));
  assert.equal(published.length, 36);
  assert.ok(published.every((p) => p.passport && !p.contact && !p.password));
  assert.ok(published.flatMap((p) => p.memories).every((memory) => memory && !Object.hasOwn(memory, "evidence")));
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".mini-card").count(), 36);
  assert.match(await page.locator(".hero-facts").textContent(), /36/);
  assert.match(await page.locator(".demo-notice").textContent(), /36 историй/);
  const mapFrame = page.getByTitle("Яндекс Карты — поселения Югры");
  await mapFrame.waitFor();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt").split("~").length, 32);
  await page.getByLabel("Показывать примерные местоположения", { exact: false }).uncheck();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt"), null);
  await page.getByLabel("Показывать примерные местоположения", { exact: false }).check();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt").split("~").length, 32);
  await page.getByRole("button", { name: "Показать на карте: п. Рябиновый", exact: true }).click();
  const focusUrl = new URL(await mapFrame.getAttribute("src"));
  assert.equal(focusUrl.searchParams.get("ll"), "72.892667,61.396667");
  assert.equal(focusUrl.searchParams.get("pt").split("~").length, 1);
  await page.getByLabel("Показывать примерные местоположения", { exact: false }).uncheck();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt"), null);
  await page.getByRole("button", { name: "Показать на карте: п. Рябиновый", exact: true }).click();
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[title="Яндекс Карты — поселения Югры"]');
    return frame && new URL(frame.src).searchParams.get("pt") === "72.892667,61.396667";
  });
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt"), "72.892667,61.396667");
  await page.getByRole("button", { name: "Все объекты", exact: true }).click();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt").split("~").length, 32);
  passed.push("Static deployment: Yandex map receives 32 real coordinate pairs, filters approximate points and focuses the selected passport");

  await page.getByLabel("Найти координаты на карте", { exact: true }).fill("61°14′24″ с. ш., 73°24′00″ в. д.");
  await page.getByRole("button", { name: "Найти точку", exact: true }).click();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("ll"), "73.4,61.24");
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt"), "73.4,61.24");
  await page.getByLabel("Найти координаты на карте", { exact: true }).fill("73.4, 61.24");
  await page.getByRole("button", { name: "Найти точку", exact: true }).click();
  assert.match(await page.getByRole("alert").textContent(), /сначала широта/);
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt"), "73.4,61.24");
  await page.getByRole("button", { name: "Все объекты", exact: true }).click();
  assert.equal(new URL(await mapFrame.getAttribute("src")).searchParams.get("pt").split("~").length, 32);
  passed.push("Static deployment: public coordinate finder accepts DMS and rejects reversed axes without changing the selected point");

  await page.getByRole("textbox", { name: "Поиск по архиву" }).fill("Немчинова");
  assert.equal(await page.locator(".mini-card").count(), 1);
  await page.locator(".mini-card-main").click();
  await page.locator(".passport-card").waitFor();
  assert.doesNotMatch(await page.locator(".place-detail").textContent(), /PAS-\d+|Проверено владельцем проекта|Сведения перенесены|рабочая версия|G1\s*\/\s*P0/);
  assert.ok(await page.locator('.passport-card a[href^="https://drive.google.com/"]').count());
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /В избранное:.*Немчинова/ }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Избранное, 1 мест" }).click();
  assert.equal(await page.locator(".story-card").count(), 1);
  passed.push("Static deployment: search, detailed passport, source and persistent favorites");

  await page.goto(`${origin}/#place/pas-029`, { waitUntil: "networkidle" });
  await page.locator(".passport-card").waitFor();
  assert.match(await page.locator(".place-detail h2").textContent(), /Кедровый/);
  assert.match(await page.locator(".passport-card").textContent(), /Точное местоположение/);
  await page.keyboard.press("Escape");
  await page.locator(".main-nav").getByRole("link", { name: "Истории", exact: true }).click();
  assert.equal(await page.locator(".story-card").count(), 36);
  passed.push("Static deployment: direct passport links and 36 story cards");
  await page.locator(".main-nav").getByRole("link", { name: "Воспоминания", exact: true }).click();
  assert.equal(await page.locator(".memoir-card").count(), 14);
  await page.getByLabel("Поиск по воспоминаниям").fill("Пугина");
  assert.equal(await page.locator(".memoir-card").count(), 1);
  assert.match(await page.locator(".memoir-narrator").textContent(), /по воспоминаниям Лукерьи/);
  assert.ok(await page.locator('.memoir-source a[href$="/i-shli-po-etapu-v-sibirskuyu-glush/"]').count());
  await page.locator(".memoir-places button").click();
  await page.locator(".place-detail .resident-memories").waitFor();
  assert.match(await page.locator(".place-detail h2").textContent(), /Ореховский/);
  assert.equal(await page.locator(".place-detail .memoir-card").count(), 1);
  await page.keyboard.press("Escape");
  await page.locator(".main-nav").getByRole("link", { name: "Воспоминания", exact: true }).click();
  await page.getByLabel("Поиск по воспоминаниям").fill("Флейшман");
  assert.equal(await page.locator(".memoir-card").count(), 1);
  assert.match(await page.locator(".memoir-narrator").textContent(), /Георгий Флейшман/);
  assert.ok(await page.locator('.memoir-source a[href^="https://stribuna.ru/"]').count());
  await page.getByLabel("Поиск по воспоминаниям").fill("несуществующий рассказчик");
  await page.getByRole("heading", { name: "Воспоминания не найдены" }).waitFor();
  await page.getByLabel("Поиск по воспоминаниям").fill("Флейшман");
  await page.locator(".memoir-places button").click();
  await page.locator(".place-detail .resident-memories").waitFor();
  assert.equal(await page.locator(".place-detail .memoir-card").count(), 3);
  await page.keyboard.press("Escape");
  passed.push("Static deployment: fourteen attributed memoirs, narrator search, original publication and correct links to the settlement");

  await page.locator(".main-nav").getByRole("link", { name: "Карта мест", exact: true }).click();
  await page.getByRole("button", { name: "OpenStreetMap", exact: true }).click();
  await page.getByRole("button", { name: "Приблизить карту", exact: true }).waitFor();
  await page.evaluate(() => {
    document.querySelector('button[aria-label="Приблизить карту"]').click();
    document.querySelector('.main-nav a[href="#stories"]').click();
  });
  // Leaflet schedules zoom completion 250 ms later; it must not touch a removed map.
  await page.waitForTimeout(350);
  assert.equal(await page.locator(".story-card").count(), 36);
  assert.deepEqual(errors, []);
  passed.push("Static deployment: immediate navigation after zooming does not access a removed map");

  await page.getByRole("button", { name: "Добавить историю", exact: true }).click();
  await page.getByRole("heading", { name: "Архив открыт для чтения" }).waitFor();
  assert.equal(await page.locator("dialog form").count(), 0);
  await page.getByRole("button", { name: "Вернуться к архиву" }).click();
  await page.locator(".admin-entry").click();
  await page.getByRole("heading", { name: "Архив открыт для чтения" }).waitFor();
  assert.equal(await page.locator('dialog input[type="password"]').count(), 0);
  await page.keyboard.press("Escape");
  assert.deepEqual(writes, []);
  passed.push("Static deployment: unavailable submissions and editor are explained before entering personal data");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/#map`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".mini-card").count(), 36);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator(".mini-card-main").first().click();
  await page.locator(".passport-card").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  passed.push("Static deployment: mobile catalogue and passport without overflow or JavaScript errors");
  await page.keyboard.press("Escape");
  await page.goto(`${origin}/#about`, { waitUntil: "networkidle" });
  await page.locator(".organization-details").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await page.locator('.organization-details a[href="mailto:novichek2@yandex.ru"]').count());
  assert.deepEqual(errors, []);
  passed.push("Organization details, contact link and rights notice fit the mobile About page");
  console.log(JSON.stringify({ staticBrowserChecks: passed, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
