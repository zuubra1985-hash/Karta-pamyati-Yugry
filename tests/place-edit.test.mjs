import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';

test('published passports: authenticated edits, photo lifecycle, conflicts, validation, audit and restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'place-edit-'));
  const file = join(dir, 'archive.sqlite');
  let store = new Store(file);
  store.createAdmin('admin@example.invalid', 'test-only-password-123');
  const cookie = `memory_session=${store.login('admin@example.invalid', 'test-only-password-123')}`;
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const original = store.place('pas-005');
  const body = {
    title: 'Уточнённый паспорт Немчиновой', location: original.location, category: original.category,
    year: null, dateLabel: '', latitude: null, longitude: null, coordinateStatus: 'unknown',
    summary: 'Новое краткое описание', story: 'Уточнённый исторический текст. '.repeat(8),
    author: original.author, source: original.source, passport: {...original.passport, economy: 'Уточнённые сведения о хозяйстве'},
    appearance: {accent: 'river', imagePosition: 'top'}, revision: 0,
    photo: {type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII='},
  };
  const patch = (data, auth = true, headers = {}) => fetch(`${base}/api/admin/places/pas-005`, {method:'PATCH', headers:{'Content-Type':'application/json', ...(auth ? {cookie} : {}), ...headers}, body:JSON.stringify(data)});
  try {
    assert.equal((await patch(body, false)).status, 401);
    assert.equal((await patch(body, true, {origin:'https://other.invalid'})).status, 403);
    assert.equal((await patch({...body, contact:'private@example.invalid'})).status, 400);
    assert.equal((await patch({...body, photo:{type:'image/png', data:'not-an-image'}})).status, 400);
    assert.equal((await patch({...body, longitude:73.4})).status, 400);
    const response = await patch(body); assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal((await fetch(`${base}/api/admin/place-edits`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/places/pas-005/history`)).status, 401);
    const history = await (await fetch(`${base}/api/admin/places/pas-005/history`, {headers:{cookie}})).json();
    assert.equal(history.length, 1);
    assert.equal(history[0].editor, 'admin@example.invalid');
    assert.equal(history[0].before.title, original.title);
    assert.equal(history[0].after.title, body.title);
    assert.deepEqual(await (await fetch(`${base}/api/admin/place-edits`, {headers:{cookie}})).json(), history);
    assert.equal((await fetch(`${base}/api/admin/places/missing/history`, {headers:{cookie}})).status, 404);
    assert.equal(saved.revision, 1); assert.equal(saved.passport.economy, body.passport.economy);
    assert.deepEqual(saved.passport.webSources, original.passport.webSources);
    assert.equal((await fetch(`${base}/api/media/${saved.mediaId}`)).status, 200);
    assert.equal((await patch(body)).status, 409);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM place_edits').get().n, 1);
    const second = await patch({...body, revision:1, photo:null, latitude:61.24, longitude:73.4, coordinateStatus:'confirmed'});
    assert.equal(second.status, 200);
    assert.equal((await fetch(`${base}/api/media/${saved.mediaId}`)).status, 404);
    assert.equal(store.db.prepare('SELECT before_data FROM place_edits WHERE revision=1').get().before_data, JSON.stringify(original));
    store.close(); store = new Store(file);
    assert.equal(store.place('pas-005').title, body.title);
    assert.equal(store.place('pas-005').latitude, 61.24);
    assert.equal(store.place('pas-005').appearance.imagePosition, 'top');
    assert.equal(store.place('pas-005').revision, 2);
  } finally {
    await new Promise(resolve => server.close(resolve)); store.close(); rmSync(dir, {recursive:true, force:true});
  }
});
