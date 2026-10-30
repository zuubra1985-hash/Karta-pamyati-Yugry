import { createClient } from '@libsql/client/http';
import { randomUUID, randomBytes } from 'node:crypto';
import { Store, hashToken, hashPassword, checkPassword } from './store.mjs';

// Each transaction owns its connection; never keep a transaction on shared request state.
export class CloudStore {
  constructor(client, blobs) { this.client = client; this.blobs = blobs; }
  static async open({url, authToken, blobs, client}) {
    const store = new CloudStore(client || createClient({url, authToken}), blobs);
    try { await store.initialize(); return store; } catch(e) {store.close();throw e;}
  }
  async execute(sql, args = [], db = this.client) { return db.execute({sql, args}); }
  async one(sql, args = [], db) { return (await this.execute(sql,args,db)).rows[0] || null; }
  async transaction(fn) {
    const tx = await this.client.transaction('write');
    try {const result=await fn(tx);await tx.commit();return result;}
    catch(e){await tx.rollback();throw e;} finally {tx.close();}
  }
  async initialize() {
    await this.client.batch([
      'CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, data TEXT NOT NULL)',
      "CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', data TEXT NOT NULL, created_at TEXT NOT NULL, reason TEXT, revision INTEGER NOT NULL DEFAULT 0)",
      'CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, blob_url TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY, password TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES admins(email), expires INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS place_edits (id TEXT PRIMARY KEY, place_id TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, created_at TEXT NOT NULL, before_data TEXT NOT NULL, after_data TEXT NOT NULL)',
      'CREATE INDEX IF NOT EXISTS place_edits_by_place ON place_edits(place_id, revision)',
      'CREATE TABLE IF NOT EXISTS submission_edits (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), revision INTEGER NOT NULL, editor TEXT NOT NULL, created_at TEXT NOT NULL, before_data TEXT NOT NULL, after_data TEXT NOT NULL)',
      'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL)',
    ],'write');
    await this.transaction(async tx=>{
      if(await this.one("SELECT 1 FROM metadata WHERE key='cloud_catalogue_v1'",[],tx))return;
      // Reuse the reviewed catalogue/migrations; no local persistent file is created.
      const seed=new Store(':memory:');
      try {for(const p of seed.places())await this.execute('INSERT OR IGNORE INTO places VALUES (?,?)',[p.id,JSON.stringify(p)],tx);}
      finally {seed.close();}
      await this.execute("INSERT INTO metadata VALUES ('cloud_catalogue_v1','done')",[],tx);
    });
  }
  async health() {await this.execute('SELECT 1');}
  async places() {return (await this.execute('SELECT data FROM places')).rows.map(r=>JSON.parse(r.data));}
  async place(id,tx) {const row=await this.one('SELECT data FROM places WHERE id=?',[id],tx);return row?JSON.parse(row.data):null;}
  async placeHistory(id) {return (await this.execute(`SELECT * FROM place_edits ${id?'WHERE place_id=?':''} ORDER BY created_at DESC, revision DESC LIMIT 100`,id?[id]:[])).rows.map(r=>({placeId:r.place_id,revision:r.revision,editor:r.editor,createdAt:r.created_at,before:JSON.parse(r.before_data),after:JSON.parse(r.after_data)}));}
  async withPhotos(photos,fn) {
    const uploaded=[];
    try {
      for(const photo of photos) {
        if(!photo){uploaded.push(photo);continue;}
        const id=randomUUID(); const url=await this.blobs.put(id,photo);
        uploaded.push({id,url,type:photo.type});
      }
      return await fn(uploaded);
    } catch(e) {
      // Blob and SQL cannot share a transaction. Remove unreferenced uploads on failure.
      for(const item of uploaded)if(item?.url)try{
        // A commit can succeed remotely even if its response was lost. Never delete
        // a referenced file; if the DB is unreachable, retain the private orphan.
        if(!await this.one('SELECT 1 FROM media WHERE blob_url=?',[item.url]))await this.blobs.del(item.url);
      }catch{}
      throw e;
    }
  }
  async saveMedia(media,tx) {await this.execute('INSERT INTO media VALUES (?,?,?)',[media.id,media.type,media.url],tx);}
  async updatePlace(id,updates,revision,editor,photo) {
    return this.withPhotos([photo],async ([image])=>this.transaction(async tx=>{
      const current=await this.place(id,tx);
      if(!current||(current.revision||0)!==revision) {
        if(image?.url)await this.blobs.del(image.url);
        return null;
      }
      const after={...current,...updates,revision:revision+1};
      if(image===null)delete after.mediaId;
      else if(image){await this.saveMedia(image,tx);after.mediaId=image.id;}
      await this.execute('INSERT INTO place_edits VALUES (?,?,?,?,?,?,?)',[randomUUID(),id,after.revision,editor,new Date().toISOString(),JSON.stringify(current),JSON.stringify(after)],tx);
      await this.execute('UPDATE places SET data=? WHERE id=?',[JSON.stringify(after),id],tx);return after;
    }));
  }
  async submit(input,photo,afterPhoto) {
    return this.withPhotos([photo,afterPhoto],async ([image,afterImage])=>this.transaction(async tx=>{
      const id=randomUUID(),data={...input};
      if(image){await this.saveMedia(image,tx);data.mediaId=image.id;}
      if(afterImage){await this.saveMedia(afterImage,tx);data.afterMediaId=afterImage.id;}
      await this.execute('INSERT INTO submissions (id,data,created_at) VALUES (?,?,?)',[id,JSON.stringify(data),new Date().toISOString()],tx);return id;
    }));
  }
  submissionRow(r) {return r?{...JSON.parse(r.data),id:r.id,status:r.status,createdAt:r.created_at,reason:r.reason,revision:r.revision}:null;}
  async submissions() {return (await this.execute('SELECT * FROM submissions ORDER BY created_at DESC')).rows.map(r=>this.submissionRow(r));}
  async submission(id,tx) {return this.submissionRow(await this.one('SELECT * FROM submissions WHERE id=?',[id],tx));}
  async revise(id,updates,revision,editor) {
    return this.transaction(async tx=>{
      const current=await this.submission(id,tx);if(!current||current.status!=='pending'||current.revision!==revision)return null;
      const row=await this.one('SELECT data FROM submissions WHERE id=?',[id],tx);
      const after={...JSON.parse(row.data),...updates};
      await this.execute('INSERT INTO submission_edits VALUES (?,?,?,?,?,?,?)',[randomUUID(),id,revision+1,editor,new Date().toISOString(),row.data,JSON.stringify(after)],tx);
      await this.execute('UPDATE submissions SET data=?,revision=revision+1 WHERE id=?',[JSON.stringify(after),id],tx);
      return this.submission(id,tx);
    });
  }
  async editHistory(id) {return (await this.execute('SELECT * FROM submission_edits WHERE submission_id=? ORDER BY revision DESC',[id])).rows.map(r=>({revision:r.revision,editor:r.editor,createdAt:r.created_at,before:JSON.parse(r.before_data),after:JSON.parse(r.after_data)}));}
  async moderate(id,action,reason='',revision) {
    return this.transaction(async tx=>{
      const r=await this.one('SELECT * FROM submissions WHERE id=?',[id],tx);
      if(!r||r.status!=='pending'||r.revision!==revision)return false;
      if(action==='approve') {
        const {contact,consent,...data}=JSON.parse(r.data);
        await this.execute('INSERT INTO places VALUES (?,?)',[id,JSON.stringify({...data,id,demo:false,summary:data.story.slice(0,160)+(data.story.length>160?'…':''),image:'river'})],tx);
      }
      await this.execute('UPDATE submissions SET status=?,reason=?,revision=revision+1 WHERE id=?',[action==='approve'?'approved':'rejected',reason,id],tx);return true;
    });
  }
  async media(id,admin=false) {
    if(!admin&&!await this.one("SELECT 1 FROM places WHERE json_extract(data,'$.mediaId')=? OR json_extract(data,'$.afterMediaId')=?",[id,id]))return null;
    const r=await this.one('SELECT * FROM media WHERE id=?',[id]);
    return r?{type:r.type,bytes:await this.blobs.get(r.blob_url)}:null;
  }
  async createAdmin(email,password) {
    if(password.length<12||password.length>256)throw new Error('Пароль должен содержать от 12 до 256 символов.');
    await this.transaction(async tx=>{
      await this.execute('INSERT INTO admins VALUES (?,?) ON CONFLICT(email) DO UPDATE SET password=excluded.password',[email.toLowerCase(),hashPassword(password)],tx);
      await this.execute('DELETE FROM sessions WHERE email=?',[email.toLowerCase()],tx);
    });
  }
  async login(email,password) {
    const r=await this.one('SELECT * FROM admins WHERE email=?',[email.toLowerCase()]);
    const valid=checkPassword(password,r?.password??(this.dummyHash??=hashPassword(randomUUID())));
    if(!r||!valid)return null;
    const token=randomBytes(32).toString('hex');
    await this.transaction(async tx=>{
      await this.execute('DELETE FROM sessions WHERE expires<?',[Date.now()],tx);
      await this.execute('INSERT INTO sessions VALUES (?,?,?)',[hashToken(token),r.email,Date.now()+8*60*60*1000],tx);
    });return token;
  }
  async session(token) {return token?this.one('SELECT email FROM sessions WHERE token=? AND expires>?',[hashToken(token),Date.now()]):null;}
  async logout(token) {if(token)await this.execute('DELETE FROM sessions WHERE token=?',[hashToken(token)]);}
  async rateLimit(key,max,windowMs) {
    return this.transaction(async tx=>{
      const now=Date.now();await this.execute('DELETE FROM rate_limits WHERE expires<=?',[now],tx);
      const id=hashToken(key),r=await this.one('SELECT * FROM rate_limits WHERE key=?',[id],tx);
      if(r&&r.hits>=max)return false;
      await this.execute('INSERT INTO rate_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',[id,1,now+windowMs],tx);return true;
    });
  }
  close() {this.client.close();}
}
