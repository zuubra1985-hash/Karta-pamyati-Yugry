import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.MEMORY_DB || resolve(root, "data/memory.sqlite");
if (!process.argv[2]) {
  console.error("Укажите путь нового файла резервной копии.");
  process.exit(1);
}
const destination = resolve(process.argv[2]);
if (existsSync(destination)) {
  console.error("Файл уже существует; перезапись запрещена.");
  process.exit(1);
}
let db;
try {
  db = new DatabaseSync(source, { readOnly: true });
  db.exec("PRAGMA busy_timeout=5000");
  db.prepare("VACUUM INTO ?").run(destination);
  console.log("Резервная копия SQLite создана. Храните её в закрытом месте.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
