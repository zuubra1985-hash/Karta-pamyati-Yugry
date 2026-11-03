import { chromium } from "playwright";
import express from "express";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import passports from "../server/data/passports.json" with {type:"json"};

// Run against build:server, deliberately offering an obsolete static catalogue.
assert.equal(existsSync("dist/catalogue/places.json"),false);
const app = express();
let offline = false, fallbackReads = 0, published = [{...passports[0],title:"Актуальная версия из базы",revision:5,appearance:{accent:"river",imagePosition:"top"}}];
app.get("/api/places", (_,res) => offline ? res.status(503).json({error:"Database unavailable"}) : res.json(published));
app.get("/catalogue/places.json", (_,res) => {fallbackReads++;res.json(passports);});
app.get("/api/*", (_,res) => res.sendStatus(401));
app.use(express.static(resolve("dist")));
app.get("*", (_,res) => res.sendFile(resolve("dist/index.html")));
const server=app.listen(0,"127.0.0.1");
await new Promise(r => server.once("listening",r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || "/usr/bin/chromium",args:["--no-sandbox"]});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.route("https://yandex.ru/map-widget/**",route => route.fulfill({contentType:"text/html",body:"<html></html>"}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  await page.goto(origin,{waitUntil:"networkidle"});
  assert.equal(await page.locator(".mini-card").count(),1);
  assert.match(await page.locator(".mini-card").innerText(),/Актуальная версия из базы/);
  offline=true;
  await page.reload({waitUntil:"networkidle"});
  assert.match(await page.getByRole("alert").innerText(),/Архив временно недоступен/);
  assert.equal(await page.locator(".mini-card").count(),0);
  assert.equal(fallbackReads,0);
  offline=false; published=[];
  await page.getByRole("button",{name:"Попробовать снова"}).click();
  await page.getByRole("heading",{name:"Пока нет таких историй"}).waitFor();
  assert.equal(await page.locator(".mini-card").count(),0);
  assert.equal(fallbackReads,0);
  console.log("PASS Server deployment: current DB edits, outage, retry and deleted records never read a stale static catalogue");
} finally {await browser.close();await new Promise(r=>server.close(r));}
