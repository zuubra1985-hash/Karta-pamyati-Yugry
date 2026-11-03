import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Send, ArrowRight } from "lucide-react";
import { api, categories, type Photo, type Place } from "../types";
import { organization } from "../organization";
import { PhotoCreditFields, readPhotoCredit } from "./PhotoCredits";
import PhotoUpload from "./PhotoUpload";
import CoordinatesFields from "./CoordinatesFields";
import { readCoordinates } from "../maps";
import { PassportFields, readPassport } from "./Passport";
export default function SubmissionForm({ onClose, relatedPlace }: { onClose: () => void; relatedPlace?: Place }) {
  const success = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [unknownLocation, setUnknownLocation] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState({ before: false, after: false });
  useEffect(() => {
    if (result) {
      success.current?.closest("dialog")?.scrollTo({top: 0});
      success.current?.focus({preventScroll: true});
    }
  }, [result]);
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
          year: values.year === "" ? null : Number(values.year),
          relatedPlaceId: relatedPlace?.id,
          photoCredit: photo ? readPhotoCredit(values) : undefined,
          afterPhotoCredit: afterPhoto ? readPhotoCredit(values, "afterPhotoCredit") : undefined,
          ...(unknownLocation ? {latitude: null, longitude: null} : readCoordinates(values)),
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
        <h2 ref={success} tabIndex={-1}>
          Теперь она
          <br />
          не потеряется.
        </h2>
        <p>
          Материал передан редактору. После проверки источников и согласий он сможет появиться в архиве. Если координаты неизвестны, история будет доступна без точки на карте.
        </p>
        <div className="receipt">
          Номер материала <code>{result}</code>
        </div>
        <p className="muted small">
          Сохраните номер, чтобы сослаться на материал при обращении к редакции.
        </p>
        <button className="button primary" onClick={onClose}>
          Вернуться к архиву <ArrowRight size={17} />
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
          редакторскую проверку перед публикацией. Год, координаты и фотографии можно не указывать.
        </p>
      </div>
      <form onSubmit={submit} className="submission-form">
        {relatedPlace && <p className="submission-context full">Вы дополняете карточку <strong>«{relatedPlace.title}»</strong>. После проверки рассказ появится в архиве со ссылкой на это место.</p>}
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
            defaultValue={relatedPlace?.title || ""}
            placeholder="Сургут"
          />
        </label>
        <label>
          Тема
          <select name="category" defaultValue={relatedPlace?.category}>
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
            placeholder="Если помните год, например 1975"
          />
        </label>
        <label className="checkbox full"><input type="checkbox" checked={unknownLocation} onChange={e => setUnknownLocation(e.target.checked)}/>Координаты неизвестны — отправить воспоминание без точки на карте</label>
        {!unknownLocation && <CoordinatesFields />}
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
          onChange={p => {setPhoto(p); if (!p) setAfterPhoto(null);}}
          onBusy={(busy) => setUploading((p) => ({ ...p, before: busy }))}
          onError={setError}
        />
        {photo && <PhotoCreditFields/>}
        {photo && <>
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
        {afterPhoto && <PhotoCreditFields second prefix="afterPhotoCredit" title="Описание и права на второй снимок"/>}
        </>}
        <label className="full">
          Источник рассказа
          <textarea
            name="source"
            rows={2}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Личный рассказ; семейный архив; ссылка на публикацию"
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
        <p className="full small muted">Материал принимает {organization.shortName}. Автор и источник будут указаны при публикации; права на ваши текст и фотографии сохраняются за вами. Для уточнения или отзыва материала: <a href={`mailto:${organization.email}`}>{organization.email}</a>.</p>
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
            Затем — публикация в архиве.
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
