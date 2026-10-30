import { CloudStore } from './cloud-store.mjs';
import { privateBlobs } from './blob-storage.mjs';
export function cloudConfiguration(env=process.env) {
  const names=['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','BLOB_READ_WRITE_TOKEN','APP_ORIGIN'];
  const missing=names.filter(name=>!env[name]);
  if(missing.length)throw new Error(`Не настроены переменные: ${missing.join(', ')}`);
  const url=new URL(env.TURSO_DATABASE_URL), origin=new URL(env.APP_ORIGIN);
  if(!['libsql:','https:'].includes(url.protocol))throw new Error('Для Turso требуется защищённый сетевой адрес.');
  if(url.searchParams.get('tls') === '0')throw new Error('Проверка TLS не может быть отключена.');
  if(url.username||url.password)throw new Error('Токен Turso указывается отдельной переменной.');
  if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN)throw new Error('APP_ORIGIN должен быть точным HTTPS origin без завершающего слеша.');
  return {url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN,origin:env.APP_ORIGIN};
}
export async function openCloudStore() {
  const config=cloudConfiguration();
  return CloudStore.open({...config,blobs:privateBlobs});
}
