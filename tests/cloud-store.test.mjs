import {createClient} from '@libsql/client';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CloudStore} from '../server/cloud-store.mjs';
import {createApp} from '../server/app.mjs';
import {cloudConfiguration} from '../server/cloud-runtime.mjs';

const input={title:'История из облачного архива',location:'Сургут',category:'people',year:1975,latitude:61.24,longitude:73.4,story:'Проверка сохранения рассказа в облачной базе. '.repeat(5),author:'Тестовый автор',contact:'private@example.invalid',source:'Тестовый семейный архив',consent:true};
const png={type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII='};
test('cloud backend: persistence across instances, private blobs, moderation, revisions, rate limits and failed-upload cleanup',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'yugra-cloud-')),url=`file:${join(dir,'test.sqlite')}`;
 const files=new Map();let downloads=0;
 const blobs={async put(id,photo){const url=`https://private.blob.invalid/${id}`;files.set(url,Buffer.from(photo.bytes));return url;},async get(url){downloads++;assert.ok(files.has(url));return files.get(url);},async del(url){files.delete(url);}};
 let store=await CloudStore.open({client:createClient({url}),blobs}),server,base;
 const start=async()=>{server=createApp(store,{production:true,origin:'https://archive.example.invalid'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;};
 const request=(path,method='GET',body,cookie)=>fetch(base+path,{method,headers:{'Content-Type':'application/json',origin:'https://archive.example.invalid',...cookie?{cookie}:{}},body:body===undefined?undefined:JSON.stringify(body)});
 try {
  await store.createAdmin('cloud@example.invalid','test-cloud-password-only');await start();
  assert.equal((await (await request('/api/health')).json()).status,'ok');
  assert.equal((await (await request('/api/places')).json()).length,36);
  const submitted=await request('/api/submissions','POST',{...input,photo:png,afterPhoto:png,afterYear:2020,afterSource:'Тестовый снимок'});assert.equal(submitted.status,201);
  const {id}=await submitted.json();const current=await store.submission(id);
  assert.equal((await request(`/api/media/${current.mediaId}`)).status,404);assert.equal(downloads,0);
  const login=await request('/api/admin/login','POST',{email:'cloud@example.invalid',password:'test-cloud-password-only'});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/Secure/);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(`/api/media/${current.afterMediaId}`,'GET',undefined,cookie)).status,200);
  const {contact,consent,...edit}=input;
  assert.equal((await request(`/api/admin/submissions/${id}`,'PATCH',{...edit,afterYear:2020,afterSource:'Тестовый снимок',revision:0},cookie)).status,200);
  assert.equal((await request(`/api/admin/submissions/${id}`,'POST',{action:'approve',revision:0},cookie)).status,409);
  assert.equal((await request(`/api/admin/submissions/${id}`,'POST',{action:'approve',revision:1},cookie)).status,200);
  const published=await (await request(`/api/places/${id}`)).json();assert.equal(published.contact,undefined);assert.equal(published.consent,undefined);
  assert.equal((await request(`/api/media/${current.mediaId}`)).status,200);
  const patch={...edit,title:'Изменённая история в Turso',summary:'Проверка сохранения',dateLabel:'',coordinateStatus:'confirmed',passport:null,appearance:{accent:'river',imagePosition:'top'},revision:0,photo:png};
  assert.equal((await request(`/api/admin/places/${id}`,'PATCH',patch,cookie)).status,200);
  const count=files.size;assert.equal((await request(`/api/admin/places/${id}`,'PATCH',patch,cookie)).status,409);assert.equal(files.size,count);
  const other=await CloudStore.open({client:createClient({url}),blobs});
  try {assert.equal((await other.place(id)).title,patch.title);assert.equal(await store.rateLimit('shared-test',2,60000),true);assert.equal(await other.rateLimit('shared-test',2,60000),true);assert.equal(await store.rateLimit('shared-test',2,60000),false);}finally{other.close();}
  await store.execute("CREATE TRIGGER refuse_submission BEFORE INSERT ON submissions BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  await assert.rejects(store.submit(input,{type:'image/png',bytes:Buffer.from(png.data,'base64')}));assert.equal(files.size,count);
  await store.execute('DROP TRIGGER refuse_submission');
  await new Promise(r=>server.close(r));server=null;store.close();store=await CloudStore.open({client:createClient({url}),blobs});await start();
  assert.equal((await request('/api/admin/session','GET',undefined,cookie)).status,200);
  assert.equal((await (await request(`/api/admin/places/${id}/history`,'GET',undefined,cookie)).json()).length,1);
  assert.equal((await (await request(`/api/places/${id}`)).json()).title,patch.title);
  await request('/api/admin/logout','POST',{},cookie);assert.equal((await request('/api/admin/session','GET',undefined,cookie)).status,401);
 }finally{if(server)await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('Vercel configuration rejects absent bindings and local or insecure database URLs',()=>{
 assert.throws(()=>cloudConfiguration({}),/TURSO_DATABASE_URL/);
 const env={TURSO_DATABASE_URL:'libsql://test.turso.io',TURSO_AUTH_TOKEN:'test-only',BLOB_READ_WRITE_TOKEN:'test-only',APP_ORIGIN:'https://archive.example.invalid'};
 assert.equal(cloudConfiguration(env).origin,env.APP_ORIGIN);
 assert.throws(()=>cloudConfiguration({...env,TURSO_DATABASE_URL:'file:/tmp/test'}));
 assert.throws(()=>cloudConfiguration({...env,APP_ORIGIN:'http://example.invalid'}));
 assert.throws(()=>cloudConfiguration({...env,APP_ORIGIN:'https://example.invalid/'}));
});
