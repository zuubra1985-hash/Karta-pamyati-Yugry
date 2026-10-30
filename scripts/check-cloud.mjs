import { randomUUID } from 'node:crypto';
import { openCloudStore } from '../server/cloud-runtime.mjs';
import { privateBlobs } from '../server/blob-storage.mjs';
let store, url;
try {
  store=await openCloudStore();
  await store.health();
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGuUAAAAASUVORK5CYII=','base64');
  url=await privateBlobs.put(`connection-check-${randomUUID()}`,{type:'image/png',bytes});
  if(!(await privateBlobs.get(url)).equals(bytes))throw new Error('Проверка фотографии не прошла.');
  await privateBlobs.del(url);url=undefined;
  console.log('Turso и закрытый Vercel Blob: чтение, запись и удаление проверены.');
} catch {
  console.error('Не удалось проверить облачные подключения. Проверьте переменные Turso и токен закрытого Vercel Blob.');
  process.exitCode=1;
} finally {
  if(url)try{await privateBlobs.del(url);}catch{console.error('Не удалось удалить временный файл проверки; удалите connection-check из Blob.');}
  store?.close();
}
