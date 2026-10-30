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
import passportPlaces from "./data/passports.json" with { type: "json" };
import passportReview from "./data/passport-review.json" with { type: "json" };

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
  constructor(filename, { seed = true, catalogue = seed } = {}) {
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
      CREATE TABLE IF NOT EXISTS place_edits (id TEXT PRIMARY KEY, place_id TEXT NOT NULL, revision INTEGER NOT NULL, editor TEXT NOT NULL, created_at TEXT NOT NULL, before_data TEXT NOT NULL, after_data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    // Additive migration: existing submissions and their original content are retained.
    if (
      !this.db
        .prepare("PRAGMA table_info(submissions)")
        .all()
        .some((c) => c.name === "revision")
    )
      this.db.exec(
        "ALTER TABLE submissions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
      );
    this.db.exec(`CREATE TABLE IF NOT EXISTS submission_edits (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
      revision INTEGER NOT NULL, editor TEXT NOT NULL, created_at TEXT NOT NULL,
      before_data TEXT NOT NULL, after_data TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS submission_edits_by_submission ON submission_edits(submission_id, revision);`);
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
    if (
      seed &&
      !this.db
        .prepare("SELECT 1 FROM metadata WHERE key='comparison_demo_v2'")
        .get()
    ) {
      this.transaction(() => {
        const current = this.place("old-surgut");
        if (
          current?.demo === true &&
          !current.afterMediaId &&
          !current.afterImage
        ) {
          this.db.prepare("UPDATE places SET data=? WHERE id=?").run(
            JSON.stringify({
              ...current,
              afterImage: "village-now",
              afterYear: 2020,
              afterSource:
                "Авторская иллюстрация для демонстрации сравнения. Не исторический снимок.",
            }),
            current.id,
          );
        }
        this.db
          .prepare("INSERT INTO metadata VALUES ('comparison_demo_v2', 'done')")
          .run();
      });
    }
    if (catalogue) this.importCatalogue();
  }
  importCatalogue() {
    if (
      !this.db
        .prepare("SELECT 1 FROM metadata WHERE key='surgut_passports_2026_v1'")
        .get()
    )
      this.transaction(() => {
        for (const place of passportPlaces)
          this.db
            .prepare("INSERT OR IGNORE INTO places VALUES (?, ?)")
            .run(place.id, JSON.stringify(place));
        this.db
          .prepare(
            "INSERT INTO metadata VALUES ('surgut_passports_2026_v1', 'done')",
          )
          .run();
      });
    this.confirmCatalogueVerification();
    this.applyCatalogueReview();
  }
  applyCatalogueReview() {
    const key = passportReview.id;
    if (this.db.prepare("SELECT 1 FROM metadata WHERE key=?").get(key)) return;
    this.transaction(() => {
      for (const patch of passportReview.patches) {
        const current = this.place(patch.id);
        if (!current || current.catalogue !== "surgut-passports-2026-v1") continue;
        for (const change of patch.changes) {
          const [field, nested] = change.path.split(".");
          if (nested && !current[field]) continue;
          const previous = nested ? current[field][nested] : current[field];
          // Update only the exact imported field; preserve independent owner edits.
          if (hashToken(JSON.stringify(previous ?? null)) !== change.beforeHash) continue;
          if (nested) current[field][nested] = change.value;
          else current[field] = change.value;
        }
        this.db.prepare("UPDATE places SET data=? WHERE id=?").run(JSON.stringify(current), current.id);
      }
      this.db.prepare("INSERT INTO metadata VALUES (?, ?)").run(key, "done");
    });
  }
  confirmCatalogueVerification() {
    const key = "surgut_passports_owner_verified_20261029";
    if (this.db.prepare("SELECT 1 FROM metadata WHERE key=?").get(key)) return;
    this.transaction(() => {
      const oldIntro =
        "Сведения ниже перенесены из рабочего историко-краеведческого паспорта проекта. Они требуют проверки по первоисточникам.";
      for (const original of passportPlaces) {
        const current = this.place(original.id);
        if (
          !current ||
          current.catalogue !== original.catalogue ||
          current.verificationStatus !== "working"
        )
          continue;
        const updated = {
          ...current,
          verificationStatus: "verified",
          verification: original.verification,
          story: current.story?.startsWith(oldIntro)
            ? current.story.replace(
                oldIntro,
                "Сведения перенесены из историко-краеведческого паспорта, проверенного владельцем проекта.",
              )
            : current.story,
          source: current.source?.replace(
            "Рабочие сведения составителя, не независимая научная верификация.",
            "Паспорт проверен владельцем проекта 29 октября 2026 года.",
          ),
        };
        this.db
          .prepare("UPDATE places SET data=? WHERE id=?")
          .run(JSON.stringify(updated), current.id);
      }
      this.db.prepare("INSERT INTO metadata VALUES (?, ?)").run(key, "done");
    });
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
    const places = this.db
      .prepare("SELECT data FROM places")
      .all()
      .map((r) => JSON.parse(r.data));
    return places.some((p) => p.catalogue)
      ? places.filter((p) => !p.demo)
      : places;
  }
  place(id) {
    const row = this.db.prepare("SELECT data FROM places WHERE id=?").get(id);
    return row ? JSON.parse(row.data) : null;
  }
  updatePlace(id, updates, revision, editor, photo) {
    return this.transaction(() => {
      const current = this.place(id);
      if (!current || (current.revision || 0) !== revision) return null;
      const after = { ...current, ...updates, revision: revision + 1 };
      if (photo === null) delete after.mediaId;
      else if (photo) {
        after.mediaId = randomUUID();
        this.db.prepare("INSERT INTO media VALUES (?, ?, ?)").run(after.mediaId, photo.type, photo.bytes);
      }
      this.db.prepare("INSERT INTO place_edits VALUES (?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), id, after.revision, editor, new Date().toISOString(), JSON.stringify(current), JSON.stringify(after));
      this.db.prepare("UPDATE places SET data=? WHERE id=?").run(JSON.stringify(after), id);
      return after;
    });
  }
  submit(input, photo, afterPhoto) {
    return this.transaction(() => {
      const id = randomUUID();
      const data = { ...input };
      if (photo) {
        data.mediaId = randomUUID();
        this.db
          .prepare("INSERT INTO media VALUES (?, ?, ?)")
          .run(data.mediaId, photo.type, photo.bytes);
      }
      if (afterPhoto) {
        data.afterMediaId = randomUUID();
        this.db
          .prepare("INSERT INTO media VALUES (?, ?, ?)")
          .run(data.afterMediaId, afterPhoto.type, afterPhoto.bytes);
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
        revision: r.revision,
        ...JSON.parse(r.data),
      }));
  }
  submission(id) {
    const row = this.db.prepare("SELECT * FROM submissions WHERE id=?").get(id);
    return row
      ? {
          ...JSON.parse(row.data),
          id: row.id,
          status: row.status,
          revision: row.revision,
          reason: row.reason,
          createdAt: row.created_at,
        }
      : null;
  }
  revise(id, updates, revision, editor) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM submissions WHERE id=?")
        .get(id);
      if (!row || row.status !== "pending" || row.revision !== revision)
        return null;
      const after = { ...JSON.parse(row.data), ...updates };
      this.db
        .prepare("INSERT INTO submission_edits VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(
          randomUUID(),
          id,
          revision + 1,
          editor,
          new Date().toISOString(),
          row.data,
          JSON.stringify(after),
        );
      this.db
        .prepare(
          "UPDATE submissions SET data=?, revision=revision+1 WHERE id=?",
        )
        .run(JSON.stringify(after), id);
      return this.submission(id);
    });
  }
  editHistory(id) {
    return this.db
      .prepare(
        "SELECT revision, editor, created_at, before_data, after_data FROM submission_edits WHERE submission_id=? ORDER BY revision DESC",
      )
      .all(id)
      .map((row) => ({
        revision: row.revision,
        editor: row.editor,
        createdAt: row.created_at,
        before: JSON.parse(row.before_data),
        after: JSON.parse(row.after_data),
      }));
  }
  moderate(id, action, reason = "", revision) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM submissions WHERE id=?")
        .get(id);
      if (
        !row ||
        row.status !== "pending" ||
        (revision !== undefined && row.revision !== revision)
      )
        return false;
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
        .prepare(
          "UPDATE submissions SET status=?, reason=?, revision=revision+1 WHERE id=?",
        )
        .run(action === "approve" ? "approved" : "rejected", reason, id);
      return true;
    });
  }
  media(id, admin = false) {
    if (
      !admin &&
      !this.db
        .prepare(
          "SELECT 1 FROM places WHERE json_extract(data, '$.mediaId')=? OR json_extract(data, '$.afterMediaId')=?",
        )
        .get(id, id)
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
