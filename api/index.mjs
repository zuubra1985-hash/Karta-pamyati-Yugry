import { createApp } from '../server/app.mjs';
import { openCloudStore, cloudConfiguration } from '../server/cloud-runtime.mjs';
let application;
export default async function handler(req,res) {
  try {
    application ??= openCloudStore().then(store=>createApp(store,{production:true,origin:cloudConfiguration().origin,trustProxy:1}));
    const app=await application;
    return app(req,res);
  } catch {
    application=undefined;
    res.setHeader('Cache-Control','no-store');
    res.statusCode=503;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'Сервер архива не подключён к базе или хранилищу. Проверьте настройки проекта Vercel.'}));
  }
}
