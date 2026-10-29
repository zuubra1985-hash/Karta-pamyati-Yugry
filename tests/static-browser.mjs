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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const passed = [];
try {
  const published = JSON.parse(readFileSync("dist/catalogue/places.json", "utf8"));
  assert.equal(published.length, 36);
  assert.ok(published.every((p) => p.passport && !p.contact && !p.password));
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".mini-card").count(), 36);
  assert.match(await page.locator(".hero-facts").textContent(), /36/);
  assert.match(await page.locator(".demo-notice").textContent(), /36 историй/);
  assert.equal(await page.locator(".memory-pin.hypothesis").count(), 0);
  await page.getByRole("button", { name: /^Показать гипотезы/ }).click();
  assert.equal(await page.locator(".memory-pin.hypothesis").count(), 35);
  passed.push("Static deployment: 36 verified passports and 35 opt-in coordinate hypotheses without an API");

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
  assert.match(await page.locator(".passport-card").textContent(), /Не локализован/);
  await page.keyboard.press("Escape");
  await page.locator(".main-nav").getByRole("link", { name: "Истории", exact: true }).click();
  assert.equal(await page.locator(".story-card").count(), 36);
  passed.push("Static deployment: direct passport links and 36 story cards");

  await page.locator(".main-nav").getByRole("link", { name: "Карта мест", exact: true }).click();
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
  await page.locator(".footer-top").getByRole("button", { name: /Редакция/ }).click();
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
  console.log(JSON.stringify({ staticBrowserChecks: passed, errors }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
