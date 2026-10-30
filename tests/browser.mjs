import { chromium } from "playwright";
import express from "express";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";

// Isolated data: browser tests never add test people/stories to the working archive.
const store = new Store(":memory:", { catalogue: false });
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
await page.addInitScript(() => {
  if (window !== window.top) return;
  try { localStorage.setItem("yugra-map-provider", "osm"); } catch { /* Unavailable on opaque documents. */ }
});
await page.route("https://*.tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMWQAAAAASUVORK5CYII=", "base64") }));
await page.route("https://yandex.ru/map-widget/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Map provider stub for repeatable UI tests</body></html>" }));
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
  await page
    .getByRole("slider", { name: "Начальный год", exact: true })
    .fill("1970");
  await page
    .getByRole("slider", { name: "Конечный год", exact: true })
    .fill("1980");
  assert.equal(await page.locator(".mini-card").count(), 4);
  assert.equal(await page.locator(".leaflet-marker-icon").count(), 4);
  await page
    .getByRole("slider", { name: "Начальный год", exact: true })
    .fill("1990");
  assert.equal(await page.locator(".mini-card").count(), 1);
  await page
    .getByRole("slider", { name: "Конечный год", exact: true })
    .fill("1970");
  assert.equal(await page.locator(".mini-card").count(), 2);
  await page.getByRole("button", { name: "Все годы", exact: true }).click();
  assert.equal(await page.locator(".mini-card").count(), 8);
  passed.push(
    "Timeline: date range, synchronized markers, crossed handles and reset",
  );
  await page.getByRole("button", { name: "Без примеров", exact: true }).click();
  await page.locator(".place-scroll .empty").waitFor();
  await page.getByRole("button", { name: "Без примеров", exact: true }).click();
  passed.push("Search, category, decade and demonstration filters");
  await page.locator(".mini-card-main").first().click();
  await page.getByRole("dialog").waitFor();
  await page.locator(".comparison").waitFor();
  await page
    .getByRole("slider", { name: "Положение разделителя", exact: true })
    .fill("25");
  assert.ok(
    (await page.locator(".comparison-before").getAttribute("style")).includes(
      "75%",
    ),
  );
  await page
    .getByRole("button", { name: "Показать рядом", exact: true })
    .click();
  assert.equal(await page.locator(".comparison-pair figure").count(), 2);
  await page
    .getByRole("button", { name: "С разделителем", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Положение разделителя", exact: true })
    .focus();
  await page.keyboard.press("End");
  assert.equal(
    await page
      .getByRole("slider", { name: "Положение разделителя", exact: true })
      .inputValue(),
    "100",
  );
  passed.push(
    "Before/after comparison: separator, keyboard and side-by-side mode",
  );
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
  const coordinates = dialog.getByLabel("Координаты объекта", {exact:true});
  assert.equal(await dialog.locator('.coordinates-fields input:not([type="hidden"])').count(),1);
  await coordinates.fill("61°14′24″ с. ш., 73°24′00″ в. д.");
  assert.equal(await dialog.locator('input[name="latitude"]').inputValue(), "61.24");
  assert.equal(await dialog.locator('input[name="longitude"]').inputValue(), "73.4");
  await coordinates.fill("73.4, 61.24");
  await coordinates.blur();
  assert.equal(await coordinates.evaluate(el=>el.validity.valid),false);
  assert.equal(await dialog.locator('input[name="latitude"]').inputValue(), "");
  assert.equal(await dialog.getByTitle("Предпросмотр координат на Яндекс Картах").count(),0);
  await coordinates.fill("61,24; 73,4");
  assert.equal(await coordinates.evaluate(el=>el.validity.valid),true);
  assert.equal(await dialog.locator('.coordinates-fields [role="alert"]').count(),0);
  const preview = dialog.getByTitle("Предпросмотр координат на Яндекс Картах");
  await preview.waitFor();
  assert.equal(new URL(await preview.getAttribute("src")).searchParams.get("ll"), "73.4,61.24");
  passed.push("One coordinate field: DMS/decimal parsing, invalid input clears stale values and preview, corrected input restores validity");
  await dialog
    .getByLabel("Ваша история")
    .fill(
      "Тестовый рассказ, созданный исключительно в изолированной базе автоматической проверки. ".repeat(
        3,
      ),
    );
  await dialog.getByLabel("Первый снимок", { exact: true }).setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog
    .getByLabel("Второй снимок для сравнения", { exact: true })
    .setInputFiles({
      name: "now.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await dialog.getByLabel("Год второго снимка", { exact: true }).fill("2020");
  await dialog
    .getByLabel("Источник второго снимка", { exact: true })
    .fill("Второй снимок — изолированный тест");
  await dialog
    .getByLabel("Источник и автор фотографии")
    .fill("Изолированный тест, автор — автоматическая проверка");
  await dialog.getByLabel("Ваше имя", { exact: true }).fill("Тестовый автор");
  await dialog
    .getByLabel("Email для редактора")
    .fill("private-browser@example.invalid");
  await dialog
    .getByRole("checkbox", { name: /Есть документ-источник/ })
    .check();
  await dialog
    .getByLabel("Официальное название объекта", { exact: true })
    .fill("Объект из изолированного тестового паспорта");
  await dialog
    .getByLabel("Вид объекта", { exact: true })
    .fill("Тестовый объект");
  await dialog
    .getByLabel("Датировка по паспорту", { exact: true })
    .fill("1975–1976");
  await dialog
    .getByLabel("Название документа-источника", { exact: true })
    .fill("Тестовый паспорт, не реальный документ");
  await dialog
    .getByLabel("Архивный шифр или страница", { exact: true })
    .fill("Тест / страница 2");
  await dialog.getByRole("checkbox", { name: /Я имею право/ }).check();
  await dialog
    .getByRole("button", { name: "Отправить историю", exact: true })
    .click();
  await dialog.locator(".submission-success").waitFor();
  assert.equal(store.submissions().length, 1);
  assert.equal(store.places().length, 8);
  await dialog.getByRole("button", { name: "Вернуться к карте" }).click();
  passed.push("Submit story with image and consent; remains unpublished");
  await page.locator(".admin-entry").click();
  await page
    .getByRole("dialog")
    .getByLabel("Email", { exact: true })
    .fill("browser@example.invalid");
  await page
    .getByRole("dialog")
    .getByLabel("Пароль", { exact: true })
    .fill("browser-test-password-only");
  await page.getByRole("button", { name: "Войти в редакцию" }).click();
  await page.getByRole("button", { name: /^Материалы жителей/ }).click();
  await page.locator(".review-card").waitFor();
  await page
    .getByRole("button", { name: "Уточнить материал", exact: true })
    .click();
  await page
    .getByLabel("Заголовок материала", { exact: true })
    .fill("Уточнённая история из браузерной проверки");
  await page
    .getByLabel("Источник материала", { exact: true })
    .fill("Источник уточнён редактором в изолированном тесте");
  await page
    .getByRole("button", { name: "Сохранить уточнения", exact: true })
    .click();
  await page.locator(".editor-notice").waitFor();
  assert.equal(store.submissions()[0].revision, 1);
  await page
    .getByRole("button", { name: "История правок", exact: true })
    .click();
  await page.locator(".edit-history summary").click();
  assert.ok(
    (await page.locator(".edit-history").textContent()).includes(
      "Воспоминание из браузерной проверки",
    ),
  );
  passed.push(
    "Editorial correction: saved revision, original preserved, history visible",
  );
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
  const approved = store
    .places()
    .find((p) => p.title === "Уточнённая история из браузерной проверки");
  assert.equal(approved.afterYear, 2020);
  assert.equal(
    approved.passport.documentTitle,
    "Тестовый паспорт, не реальный документ",
  );
  await page.goto(`${origin}/#place/${approved.id}`, {
    waitUntil: "networkidle",
  });
  await page.locator(".place-detail .comparison").waitFor();
  await page
    .getByRole("region", { name: "Паспорт объекта", exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".passport-card").textContent()).includes(
      "Тест / страница 2",
    ),
  );
  assert.ok(
    (await page.locator(".comparison-source").textContent()).includes(
      "Второй снимок",
    ),
  );
  await page.keyboard.press("Escape");
  passed.push(
    "Published contributor pair, passport fields and sources are visible in the public story",
  );
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
  await page.locator(".mini-card-main").first().click();
  await page
    .getByRole("button", { name: "Показать рядом", exact: true })
    .click();
  assert.equal(await page.locator(".comparison-pair figure").count(), 2);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Истории", exact: true })
    .click();
  await page.locator(".story-card").first().waitFor();
  assert.equal(await page.locator(".main-nav").isVisible(), false);
  passed.push("Mobile layout and menu");
  store.importCatalogue();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/#map", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".mini-card").count(), 38);
  assert.equal(await page.locator(".memory-pin.hypothesis").count(), 32);
  await page.getByLabel("Показывать примерные местоположения", { exact: false }).uncheck();
  assert.equal(await page.locator(".memory-pin.hypothesis").count(), 0);
  await page.getByLabel("Показывать примерные местоположения", { exact: false }).check();
  assert.equal(await page.locator(".memory-pin.hypothesis").count(), 32);
  await page.getByRole("textbox", { name: "Поиск по архиву" }).fill("Кедровый");
  assert.equal(await page.locator(".mini-card").count(), 1);
  assert.equal(await page.locator(".leaflet-marker-icon").count(), 0);
  await page.locator(".mini-card-main").click();
  await page.locator(".passport-card").waitFor();
  assert.ok(
    (await page.locator(".passport-card").textContent()).includes(
      "Точное местоположение",
    ),
  );
  assert.ok(
    (await page.locator(".source-box").textContent()).includes(
      "Местоположение не установлено",
    ),
  );
  assert.doesNotMatch(
    await page.locator(".place-detail").textContent(),
    /PAS-\d+|Проверено владельцем проекта|Сведения перенесены|рабочая версия|G1\s*\/\s*P0/,
  );
  assert.ok(
    !(await page.locator(".place-detail").textContent()).includes(
      "требуют проверки по первоисточникам",
    ),
  );
  await page
    .getByRole("link", { name: "Открыть папку источника", exact: true })
    .getAttribute("href")
    .then((href) => assert.ok(href.includes("drive.google.com")));
  await page.keyboard.press("Escape");
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Маршруты памяти" })
    .click();
  await page.locator(".route-card").first().click();
  assert.equal(await page.locator(".route-detail li").count(), 6);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/#map", { waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  passed.push(
    "36 source passports: optional approximate points, no invented coordinates for PAS-029, traceable sources and thematic collections",
  );
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
