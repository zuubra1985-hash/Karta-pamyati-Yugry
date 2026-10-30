import { put, get, del } from '@vercel/blob';
export const privateBlobs = {
  async put(id, photo) {
    const blob = await put(`archive/${id}`,photo.bytes,{access:'private',contentType:photo.type,addRandomSuffix:false});
    return blob.url;
  },
  async get(url) {
    const blob = await get(url,{access:'private',useCache:false});
    if(!blob || blob.statusCode!==200)throw new Error('Фотография недоступна в хранилище.');
    return Buffer.from(await new Response(blob.stream).arrayBuffer());
  },
  async del(url) {await del(url);},
};
