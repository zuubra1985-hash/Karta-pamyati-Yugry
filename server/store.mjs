import { DatabaseSync } from "node:sqlite";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seedPlaces } from "./seed.mjs";

export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const expected = Buffer.from(hex, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class Store {
  constructor(filename, { seed = true } = {}) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', data TEXT NOT NULL, created_at TEXT NOT NULL, reason TEXT);
      CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, bytes BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES admins(email), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    if (
      seed &&
      !this.db.prepare("SELECT 1 FROM metadata WHERE key='seed_v1'").get()
    ) {
      this.transaction(() => {
        for (const p of seedPlaces)
          this.db
            .prepare("INSERT OR IGNORE INTO places VALUES (?, ?)")
            .run(p.id, JSON.stringify(p));
        this.db
          .prepare("INSERT INTO metadata VALUES ('seed_v1', 'done')")
          .run();
      });
    }
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  places() {
    return this.db
      .prepare("SELECT data FROM places")
      .all()
      .map((r) => JSON.parse(r.data));
  }
  place(id) {
    const row = this.db.prepare("SELECT data FROM places WHERE id=?").get(id);
    return row ? JSON.parse(row.data) : null;
  }
  submit(input, photo) {
    return this.transaction(() => {
      const id = randomUUID();
      const data = { ...input };
      if (photo) {
        data.mediaId = randomUUID();
        this.db
          .prepare("INSERT INTO media VALUES (?, ?, ?)")
          .run(data.mediaId, photo.type, photo.bytes);
      }
      this.db
        .prepare(
          "INSERT INTO submissions (id, data, created_at) VALUES (?, ?, ?)",
        )
        .run(id, JSON.stringify(data), new Date().toISOString());
      return id;
    });
  }
  submissions() {
    return this.db
      .prepare("SELECT * FROM submissions ORDER BY created_at DESC")
      .all()
      .map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        reason: r.reason,
        ...JSON.parse(r.data),
      }));
  }
  moderate(id, action, reason = "") {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM submissions WHERE id=?")
        .get(id);
      if (!row || row.status !== "pending") return false;
      if (action === "approve") {
        const { contact, consent, ...data } = JSON.parse(row.data);
        const place = {
          ...data,
          id,
          demo: false,
          summary:
            data.story.slice(0, 160) + (data.story.length > 160 ? "…" : ""),
          image: "river",
        };
        this.db
          .prepare("INSERT INTO places VALUES (?, ?)")
          .run(id, JSON.stringify(place));
      }
      this.db
        .prepare("UPDATE submissions SET status=?, reason=? WHERE id=?")
        .run(action === "approve" ? "approved" : "rejected", reason, id);
      return true;
    });
  }
  media(id, admin = false) {
    if (
      !admin &&
      !this.db
        .prepare("SELECT 1 FROM places WHERE json_extract(data, '$.mediaId')=?")
        .get(id)
    )
      return null;
    return (
      this.db.prepare("SELECT type, bytes FROM media WHERE id=?").get(id) ??
      null
    );
  }
  createAdmin(email, password) {
    if (password.length < 12 || password.length > 256)
      throw new Error("Пароль должен содержать от 12 до 256 символов.");
    this.db
      .prepare(
        "INSERT INTO admins VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET password=excluded.password",
      )
      .run(email.toLowerCase(), hashPassword(password));
    this.db
      .prepare("DELETE FROM sessions WHERE email=?")
      .run(email.toLowerCase());
  }
  login(email, password) {
    const row = this.db
      .prepare("SELECT * FROM admins WHERE email=?")
      .get(email.toLowerCase());
    // Do equivalent password work even for unknown accounts.
    const valid = checkPassword(
      password,
      row?.password ??
        this.dummyHash ??
        (this.dummyHash = hashPassword(randomUUID())),
    );
    if (!row || !valid) return null;
    const token = randomBytes(32).toString("hex");
    this.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    this.db
      .prepare("INSERT INTO sessions VALUES (?, ?, ?)")
      .run(hashToken(token), row.email, Date.now() + 8 * 60 * 60 * 1000);
    return token;
  }
  session(token) {
    return token
      ? this.db
          .prepare("SELECT email FROM sessions WHERE token=? AND expires>?")
          .get(hashToken(token), Date.now())
      : null;
  }
  logout(token) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token=?")
        .run(hashToken(token));
  }
  close() {
    this.db.close();
  }
}
