import {chromium} from "playwright";
import express from "express";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {Store} from "../server/store.mjs";
import {createApp} from "../server/app.mjs";

const store=new Store(":memory:");
const app=createApp(store);app.use(express.static(resolve("dist")));
const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || "/usr/bin/chromium",args:["--no-sandbox"]});
try {
 const origin=`http://127.0.0.1:${server.address().port}`;
 for (const width of [390,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("https://yandex.ru/map-widget/**",r=>r.fulfill({contentType:"text/html",body:"<html></html>"}));
  await page.goto(origin,{waitUntil:"networkidle"});
  await page.getByRole("button",{name:"Открыть карту",exact:true}).click();
  await page.waitForFunction(()=>Math.abs(document.getElementById("explore").getBoundingClientRect().top)<40);
  await page.getByRole("button",{name:"Как устроен проект",exact:true}).click();
  await page.waitForURL("**/#about");
  await page.getByRole("heading",{name:"Сохраним память. Вместе.",exact:true}).waitFor();
  await page.locator(".about-policy > .button").click();
  await page.locator(".submission-form").waitFor();
  await page.getByRole("button",{name:"Закрыть окно",exact:true}).click();
  await page.waitForURL("**/#about");
  for(const [name,hash] of [["Карта мест","map"],["Истории","stories"],["Воспоминания","memories"],["Маршруты памяти","routes"],["О проекте","about"]]) {
   if(width<1001)await page.getByRole("button",{name:"Открыть меню",exact:true}).click();
   await page.locator(".main-nav").getByRole("link",{name,exact:true}).click();
   await page.waitForURL(`**/#${hash}`);
   if(width<1001)assert.equal(await page.locator(".mobile-menu").getAttribute("aria-expanded"),"false");
  }
  await page.locator(".brand").click();await page.waitForURL("**/#map");
  await page.getByRole("button",{name:"Все истории",exact:false}).click();await page.waitForURL("**/#stories");
  await page.locator(".story-title").first().click();await page.waitForURL("**/#place/pas-001");
  await page.getByRole("button",{name:"Показать на карте",exact:true}).click();await page.waitForURL("**/#map");
  await page.locator(".map-focused-place").waitFor();
  await page.goBack();await page.waitForURL("**/#place/pas-001");await page.locator(".place-detail").waitFor();
  await page.goForward();await page.waitForURL("**/#map");await page.locator(".map-focused-place").waitFor();
  await page.getByRole("button",{name:"Открыть карточку",exact:false}).click();await page.locator(".place-detail").waitFor();
  await page.keyboard.press("Escape");await page.waitForURL("**/#map");
  await page.locator(".mini-card").first().getByRole("button",{name:/В избранное/}).click();
  await page.locator(".favorites-toggle").click();await page.waitForURL("**/#favorites");
  assert.equal(await page.locator(".story-card").count(),1);
  if(width<1001)await page.getByRole("button",{name:"Открыть меню",exact:true}).click();
  await page.locator(".add-top").click();await page.locator(".submission-form").waitFor();
  if(width<1001)assert.equal(await page.locator(".mobile-menu").getAttribute("aria-expanded"),"false");
  await page.keyboard.press("Escape");await page.waitForURL("**/#favorites");
  if(width<1001)await page.getByRole("button",{name:"Открыть меню",exact:true}).click();
  await page.locator(".admin-entry").click();await page.getByRole("button",{name:"Войти в кабинет",exact:true}).waitFor();
  if(width<1001)assert.equal(await page.locator(".mobile-menu").getAttribute("aria-expanded"),"false");
  await page.keyboard.press("Escape");await page.waitForURL("**/#favorites");
  assert.deepEqual(errors,[]);
  console.log(`PASS navigation at ${width}px: menu, hero, catalogue, card/map/back/forward, favorites, form and admin`);
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));store.close();}
