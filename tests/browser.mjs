import { chromium } from "playwright";
import express from "express";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";

// Isolated data: browser tests never add test people/stories to the working archive.
const store = new Store(":memory:");
store.createAdmin("browser@example.invalid", "browser-test-password-only");
const app = createApp(store);
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
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".mini-card").count(), 8);
  assert.equal(await page.locator(".leaflet-marker-icon").count(), 8);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  passed.push("Desktop: archive, map markers, no horizontal overflow");
  await page.getByRole("textbox", { name: "Поиск по архиву" }).fill("Сургут");
  assert.equal(await page.locator(".mini-card").count(), 1);
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await page.getByLabel("Тема истории", { exact: true }).selectOption("nature");
  assert.equal(await page.locator(".mini-card").count(), 2);
  await page.getByLabel("Тема истории", { exact: true }).selectOption("all");
  await page.getByLabel("Десятилетие").selectOption("1950");
  assert.equal(await page.locator(".mini-card").count(), 1);
  await page.getByLabel("Десятилетие").selectOption("all");
  await page.getByRole("button", { name: "Без примеров", exact: true }).click();
  await page.locator(".place-scroll .empty").waitFor();
  await page.getByRole("button", { name: "Без примеров", exact: true }).click();
  passed.push("Search, category, decade and demonstration filters");
  await page.locator(".mini-card-main").first().click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "Сохранить место", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Избранное,/ }).click();
  await page.locator(".story-card").first().waitFor();
  assert.equal(await page.locator(".story-card").count(), 1);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".story-card").count(), 1);
  passed.push("Story dialog, keyboard dismissal, favorites survive reload");
  await page
    .getByRole("button", { name: "Добавить историю", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Название истории")
    .fill("Воспоминание из браузерной проверки");
  await dialog.getByLabel("Город или посёлок").fill("Сургут");
  await dialog.getByLabel("Примерный год").fill("1975");
  await dialog.getByLabel("Широта").fill("61.24");
  await dialog.getByLabel("Долгота").fill("73.4");
  await dialog
    .getByLabel("Ваша история")
    .fill(
      "Тестовый рассказ, созданный исключительно в изолированной базе автоматической проверки. ".repeat(
        3,
      ),
    );
  await dialog
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await dialog
    .getByLabel("Источник и автор фотографии")
    .fill("Изолированный тест, автор — автоматическая проверка");
  await dialog.getByLabel("Ваше имя", { exact: true }).fill("Тестовый автор");
  await dialog
    .getByLabel("Email для редактора")
    .fill("private-browser@example.invalid");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Отправить историю", exact: true })
    .click();
  await dialog.locator(".submission-success").waitFor();
  assert.equal(store.submissions().length, 1);
  assert.equal(store.places().length, 8);
  await dialog.getByRole("button", { name: "Вернуться к карте" }).click();
  passed.push("Submit story with image and consent; remains unpublished");
  await page.getByRole("button", { name: "Редакция", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Email", { exact: true })
    .fill("browser@example.invalid");
  await page
    .getByRole("dialog")
    .getByLabel("Пароль", { exact: true })
    .fill("browser-test-password-only");
  await page.getByRole("button", { name: "Войти в редакцию" }).click();
  await page.locator(".review-card").waitFor();
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await page.locator(".editor .empty").waitFor();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.locator(".editor-login").waitFor();
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  assert.equal(store.places().length, 9);
  const published = await page.request.get(`${origin}/api/places`);
  assert.ok(
    !(await published.text()).includes("private-browser@example.invalid"),
  );
  passed.push("Editor login, publication, logout, private email excluded");
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Маршруты памяти" })
    .click();
  await page.locator(".route-card").first().click();
  await page.locator(".route-detail li").first().getByRole("button").click();
  await page.locator(".place-detail").waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "О проекте", exact: true })
    .click();
  await page.locator(".principles").waitFor();
  passed.push("Thematic routes and about page");
  // Text supplied by a contributor must remain plain text in React and Leaflet.
  const malicious = {
    title: '<img src=x onerror="window.xss=1">',
    location: '<img src=x onerror="window.xss=1">',
    category: "people",
    year: 2000,
    latitude: 62,
    longitude: 70,
    story: "Безопасный текст автоматической проверки. ".repeat(4),
    author: "Test",
    contact: "xss@example.invalid",
    source: "Test",
    consent: true,
  };
  const id = store.submit(malicious);
  store.moderate(id, "approve");
  await page.goto(`${origin}/#place/${id}`, { waitUntil: "networkidle" });
  await page.locator(".place-detail").waitFor();
  assert.equal(await page.evaluate(() => window.xss), undefined);
  assert.equal(await page.locator(".place-detail h2 img").count(), 0);
  await page.keyboard.press("Escape");
  passed.push("Contributor markup is rendered as text, including map labels");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/#map`, { waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Истории", exact: true })
    .click();
  await page.locator(".story-card").first().waitFor();
  assert.equal(await page.locator(".main-nav").isVisible(), false);
  passed.push("Mobile layout and menu");
  assert.deepEqual(errors, []);
  console.log(passed.map((p) => `PASS ${p}`).join("\n"));
  console.log(
    `${passed.length} browser workflows passed; no browser exceptions.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  store.close();
}
