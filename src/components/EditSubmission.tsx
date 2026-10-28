import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { api, categories, type Submission } from "../types";
import { PassportFields, readPassport } from "./Passport";
export default function EditSubmission({
  item,
  onSaved,
  onCancel,
}: {
  item: Submission;
  onSaved: (item: Submission) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const saved = await api<Submission>(`/api/admin/submissions/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...readPassport(data),
          year: Number(data.year),
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          afterYear: item.afterMediaId ? Number(data.afterYear) : undefined,
          revision: item.revision,
        }),
      });
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="edit-submission" onSubmit={submit}>
      <p className="edit-notice">
        Уточняйте материал с сохранением смысла и согласия автора. Исходная
        версия останется в закрытой истории правок. После сохранения проверьте
        карточку перед публикацией.
      </p>
      <label className="full">
        Заголовок материала
        <input
          name="title"
          required
          minLength={5}
          maxLength={150}
          defaultValue={item.title}
        />
      </label>
      <label>
        Населённый пункт
        <input
          name="location"
          required
          minLength={2}
          maxLength={100}
          defaultValue={item.location}
        />
      </label>
      <label>
        Тема материала
        <select name="category" defaultValue={item.category}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Год истории
        <input
          name="year"
          type="number"
          min={1500}
          max={new Date().getFullYear()}
          defaultValue={item.year}
          required
        />
      </label>
      <label>
        Подпись автора
        <input
          name="author"
          minLength={2}
          maxLength={100}
          defaultValue={item.author}
          required
        />
      </label>
      <label>
        Широта материала
        <input
          name="latitude"
          type="number"
          step="any"
          min={58}
          max={67}
          defaultValue={item.latitude}
          required
        />
      </label>
      <label>
        Долгота материала
        <input
          name="longitude"
          type="number"
          step="any"
          min={58}
          max={86}
          defaultValue={item.longitude}
          required
        />
      </label>
      <label className="full">
        Текст материала
        <textarea
          aria-label="Текст материала"
          name="story"
          rows={8}
          minLength={80}
          maxLength={15000}
          required
          defaultValue={item.story}
        />
      </label>
      <label className="full">
        Источник материала
        <textarea
          aria-label="Источник материала"
          name="source"
          rows={3}
          minLength={3}
          maxLength={1000}
          defaultValue={item.source}
          required
        />
      </label>
      {item.afterMediaId && (
        <>
          <label>
            Год второго снимка
            <input
              name="afterYear"
              type="number"
              min={1500}
              max={new Date().getFullYear()}
              defaultValue={item.afterYear}
              required
            />
          </label>
          <label>
            Источник второго снимка
            <textarea
              aria-label="Источник второго снимка"
              name="afterSource"
              minLength={3}
              maxLength={1000}
              defaultValue={item.afterSource}
              required
            />
          </label>
        </>
      )}
      <PassportFields initial={item.passport} />
      {error && (
        <div className="error full" role="alert">
          {error}
        </div>
      )}
      <div className="review-actions full">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Отменить правку
        </button>
        <button className="button primary" disabled={busy}>
          <Save size={15} />
          {busy ? "Сохраняем…" : "Сохранить уточнения"}
        </button>
      </div>
    </form>
  );
}
