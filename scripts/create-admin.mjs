import { createInterface } from "node:readline/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../server/store.mjs";
const input = createInterface({ input: process.stdin, output: process.stdout });
let store;
try {
  const email = (await input.question("Email редактора: "))
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Укажите корректный email.");
  // Hide readline output while entering passwords; never log or persist plaintext.
  process.stdout.write("Пароль (минимум 12 символов, ввод скрыт): ");
  input._writeToOutput = () => {};
  const password = await input.question("");
  process.stdout.write("\nПовторите пароль: ");
  const confirmation = await input.question("");
  process.stdout.write("\n");
  if (password !== confirmation) throw new Error("Пароли не совпадают.");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (process.env.TURSO_DATABASE_URL) {
    const { openCloudStore } = await import('../server/cloud-runtime.mjs');
    store = await openCloudStore();
  } else {
    store = new Store(process.env.MEMORY_DB || resolve(root, "data/memory.sqlite"));
  }
  await store.createAdmin(email, password);
  console.log("Редактор создан. Войдите через раздел «Редакция».");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  input.close();
  store?.close();
}
