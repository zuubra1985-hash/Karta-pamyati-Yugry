import { useState, type FormEvent } from "react";
import { Check, ImagePlus, Send, MapPin, ArrowRight } from "lucide-react";
import { api, categories } from "../types";
export default function SubmissionForm({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [photo, setPhoto] = useState<{
    data: string;
    type: string;
    name: string;
  } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const response = await api<{ id: string }>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          year: Number(values.year),
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
          consent: values.consent === "on",
          photo: photo ? { type: photo.type, data: photo.data } : undefined,
        }),
      });
      setResult(response.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choosePhoto(file?: File) {
    setError("");
    setPhoto(null);
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Выберите JPEG, PNG или WebP не больше 2 МБ.");
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPhoto({ data, type: file.type, name: file.name });
    } catch {
      setError("Не удалось прочитать фотографию.");
    }
  }
  if (result)
    return (
      <div className="submission-success">
        <span className="success-icon">
          <Check size={34} />
        </span>
        <span className="eyebrow">СПАСИБО ЗА ВАШУ ИСТОРИЮ</span>
        <h2>
          Теперь она
          <br />
          не потеряется.
        </h2>
        <p>
          Материал сохранён в базе и передан редактору. Он появится на карте
          после проверки источников и согласий.
        </p>
        <div className="receipt">
          Номер материала <code>{result}</code>
        </div>
        <p className="muted small">
          Сохраните номер, чтобы сослаться на материал при обращении к редакции.
        </p>
        <button className="button primary" onClick={onClose}>
          Вернуться к карте <ArrowRight size={17} />
        </button>
      </div>
    );
  return (
    <>
      <div className="form-heading">
        <span className="eyebrow">ЖИВОЙ АРХИВ НАЧИНАЕТСЯ С ВАС</span>
        <h2>
          У каждого есть
          <br />
          что сохранить.
        </h2>
        <p>
          Расскажите о месте, которое помните. Все материалы проходят
          редакторскую проверку перед публикацией.
        </p>
      </div>
      <form onSubmit={submit} className="submission-form">
        <label className="full">
          Название истории
          <input
            name="title"
            required
            minLength={5}
            maxLength={150}
            placeholder="Например, дом моей бабушки на берегу Оби"
          />
        </label>
        <label>
          Город или посёлок
          <input
            name="location"
            required
            minLength={2}
            maxLength={100}
            placeholder="Сургут"
          />
        </label>
        <label>
          Тема
          <select name="category">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Примерный год
          <input
            name="year"
            type="number"
            min={1500}
            max={new Date().getFullYear()}
            required
            placeholder="1975"
          />
        </label>
        <div className="form-hint">
          <MapPin size={18} />
          <span>
            Не знаете точный адрес? Укажите координаты центра населённого пункта
            и поясните это в рассказе.
          </span>
        </div>
        <label>
          Широта
          <input
            name="latitude"
            type="number"
            step="any"
            min={58}
            max={67}
            required
            placeholder="61.2408"
          />
        </label>
        <label>
          Долгота
          <input
            name="longitude"
            type="number"
            step="any"
            min={58}
            max={86}
            required
            placeholder="73.4072"
          />
        </label>
        <label className="full">
          Ваша история
          <textarea
            name="story"
            required
            minLength={80}
            maxLength={15000}
            rows={6}
            placeholder="Что здесь находилось? Кто жил или работал? Что особенно запомнилось? Не менее 80 символов."
          />
        </label>
        <label className="upload full">
          <ImagePlus size={24} />
          <span>
            <strong>{photo ? photo.name : "Добавить фотографию"}</strong>
            <small>JPEG, PNG, WebP · до 2 МБ · необязательно</small>
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => choosePhoto(e.target.files?.[0])}
          />
        </label>
        {photo && (
          <div className="full photo-preview">
            <img
              alt="Выбранная фотография"
              src={`data:${photo.type};base64,${photo.data}`}
            />
            <button
              type="button"
              className="text-button"
              onClick={() => setPhoto(null)}
            >
              Убрать фотографию
            </button>
          </div>
        )}
        <label className="full">
          Источник и автор фотографии
          <textarea
            name="source"
            rows={2}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Личный рассказ; семейный архив, фотограф — …; ссылка на источник"
          />
        </label>
        <label>
          Ваше имя
          <input
            name="author"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Как подписать материал"
          />
        </label>
        <label>
          Email для редактора
          <input
            name="contact"
            autoComplete="email"
            type="email"
            required
            maxLength={254}
            placeholder="Не публикуется на сайте"
          />
        </label>
        <label className="checkbox full">
          <input type="checkbox" name="consent" required />
          <span>
            Я имею право передать текст и фотографию, получил(а) согласия
            изображённых людей и разрешаю публикацию материала с моим именем.
            Email доступен только редактору. Не передаю закрытые или
            чувствительные сведения.
          </span>
        </label>
        {error && (
          <div className="error full" role="alert">
            {error}
          </div>
        )}
        <div className="form-bottom full">
          <span>
            Сначала — бережная проверка.
            <br />
            Затем — место на карте.
          </span>
          <button className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : "Отправить историю"} <Send size={16} />
          </button>
        </div>
      </form>
    </>
  );
}
