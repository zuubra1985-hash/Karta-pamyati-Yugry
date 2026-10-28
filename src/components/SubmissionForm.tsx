import { useState, type FormEvent } from "react";
import { Check, Send, MapPin, ArrowRight } from "lucide-react";
import { api, categories, type Photo } from "../types";
import PhotoUpload from "./PhotoUpload";
import { PassportFields, readPassport } from "./Passport";
export default function SubmissionForm({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState({ before: false, after: false });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (uploading.before || uploading.after) return;
    if (afterPhoto && !photo) {
      setError("Для сравнения добавьте первый снимок или уберите второй.");
      return;
    }
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const response = await api<{ id: string }>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          ...readPassport(values),
          year: Number(values.year),
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
          consent: values.consent === "on",
          photo: photo ? { type: photo.type, data: photo.data } : undefined,
          afterPhoto: afterPhoto
            ? { type: afterPhoto.type, data: afterPhoto.data }
            : undefined,
          afterYear: afterPhoto ? Number(values.afterYear) : undefined,
          afterSource: afterPhoto ? values.afterSource : undefined,
        }),
      });
      setResult(response.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
        <PhotoUpload
          label="Первый снимок"
          photo={photo}
          onChange={setPhoto}
          onBusy={(busy) => setUploading((p) => ({ ...p, before: busy }))}
          onError={setError}
        />
        <div className="comparison-form-intro full">
          <strong>Тогда и сейчас · по желанию</strong>
          <p>
            Есть второй снимок того же места? Добавьте его с годом и источником.
            После проверки редактором в карточке появится сравнение.
          </p>
        </div>
        <PhotoUpload
          label="Второй снимок для сравнения"
          photo={afterPhoto}
          onChange={setAfterPhoto}
          onBusy={(busy) => setUploading((p) => ({ ...p, after: busy }))}
          onError={setError}
        />
        {afterPhoto && (
          <>
            <label>
              Год второго снимка
              <input
                name="afterYear"
                type="number"
                min={1500}
                max={new Date().getFullYear()}
                required
                placeholder="2020"
              />
            </label>
            <label>
              Источник второго снимка
              <textarea
                name="afterSource"
                minLength={3}
                maxLength={1000}
                required
                placeholder="Автор и правообладатель второго снимка"
              />
            </label>
          </>
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
        <PassportFields />
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
            Я имею право передать текст и фотографии, получил(а) согласия
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
          <button
            className="button primary"
            disabled={busy || uploading.before || uploading.after}
          >
            {busy ? "Сохраняем…" : "Отправить историю"} <Send size={16} />
          </button>
        </div>
      </form>
    </>
  );
}
