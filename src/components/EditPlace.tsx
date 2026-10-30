import { useState, type FormEvent } from "react";
import { api, categories, imageFor, type Place, type Photo } from "../types";
import { PassportFields, readPassport } from "./Passport";
import CoordinatesFields from "./CoordinatesFields";
import { readCoordinates } from "../maps";
import PhotoUpload from "./PhotoUpload";

export default function EditPlace({place, onSaved, onCancel}: {place: Place; onSaved: (p: Place) => void; onCancel: () => void}) {
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [error, setError] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null), [removePhoto, setRemovePhoto] = useState(false);
  const [unknown, setUnknown] = useState(place.latitude === null || place.longitude === null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setBusy(true);
      const fields = readPassport(values);
      const passport = fields.passport ? {...place.passport, ...fields.passport} : null;
      if (passport) {
        for (const key of ["economy", "population", "historicalStatus", "coordinateNote"] as const) {
          if (`passport_${key}` in values) passport[key] = String(values[`passport_${key}`]).trim() || undefined;
        }
        if ("passport_references" in values) passport.references = String(values.passport_references).split("\n").map(v => v.trim()).filter(Boolean);
      }
      // Explicitly cleared passport fields must not retain their old values.
      if (passport) for (const [key, value] of Object.entries(values)) if (key.startsWith("passport_") && !String(value).trim()) delete (passport as unknown as Record<string, unknown>)[key.slice(9)];
      const saved = await api<Place>(`/api/admin/places/${encodeURIComponent(place.id)}`, {method: "PATCH", body: JSON.stringify({
        title: values.title, location: values.location, category: values.category,
        year: values.year === "" ? null : Number(values.year), dateLabel: values.dateLabel,
        summary: values.summary, story: values.story, author: values.author, source: values.source,
        ...unknown ? {latitude: null, longitude: null} : readCoordinates(values),
        coordinateStatus: unknown ? "unknown" : values.coordinateStatus,
        passport, appearance: {accent: values.accent, imagePosition: values.imagePosition},
        photo: photo ? {data: photo.data, type: photo.type} : removePhoto ? null : undefined,
        revision: place.revision || 0,
        afterYear: place.afterYear, afterSource: place.afterSource,
      })});
      onSaved(saved);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form className="edit-submission place-edit" onSubmit={save}>
    <h2 className="full">Изменить карточку</h2>
    <p className="full edit-notice">Изменения появятся на сайте после сохранения. Предыдущая версия останется в истории архива.</p>
    <label>Название<input name="title" defaultValue={place.title} required minLength={5} maxLength={150}/></label>
    <label>Населённый пункт<input name="location" defaultValue={place.location} required minLength={2} maxLength={100}/></label>
    <label>Тема<select name="category" defaultValue={place.category}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Год (если известен)<input name="year" type="number" min={1500} max={new Date().getFullYear()} defaultValue={place.year ?? ""}/></label>
    <label>Уточнение датировки<input name="dateLabel" defaultValue={place.dateLabel || ""} maxLength={150}/></label>
    <label>Автор<input name="author" defaultValue={place.author} required minLength={2} maxLength={100}/></label>
    <label className="full">Краткое описание<textarea name="summary" defaultValue={place.summary} required minLength={3} maxLength={1000}/></label>
    <label className="full">Текст карточки<textarea aria-label="Текст карточки" name="story" rows={10} defaultValue={place.story} required minLength={80} maxLength={15000}/></label>
    <label className="full">Источник<textarea name="source" defaultValue={place.source} required minLength={3} maxLength={1000}/></label>
    <PassportFields initial={place.passport}/>
    {place.passport && <fieldset className="full passport-fields"><legend>Дополнительные сведения паспорта</legend>{([
      ["economy", "Хозяйство"], ["population", "Население"], ["historicalStatus", "Исторический статус"], ["coordinateNote", "Примечание к координатам"],
    ] as const).map(([key, label]) => <label key={key}>{label}<textarea aria-label={label} name={`passport_${key}`} defaultValue={place.passport?.[key] || ""} maxLength={key === "economy" || key === "population" ? 5000 : 1000}/></label>)}<label>Литература и публикации (по одному источнику в строке)<textarea name="passport_references" defaultValue={place.passport.references?.join("\n") || ""}/></label></fieldset>}
    <fieldset className="full passport-fields"><legend>GPS</legend>
      <label className="checkbox"><input type="checkbox" checked={unknown} onChange={e => setUnknown(e.target.checked)}/>Местоположение не установлено</label>
      {!unknown && <><CoordinatesFields initial={place.latitude !== null && place.longitude !== null ? {latitude: place.latitude, longitude: place.longitude} : undefined}/><label>Достоверность координат<select name="coordinateStatus" defaultValue={place.coordinateStatus === "confirmed" ? "confirmed" : "hypothesis"}><option value="hypothesis">Примерное местоположение</option><option value="confirmed">Уточнённое местоположение</option></select></label></>}
    </fieldset>
    <fieldset className="full passport-fields"><legend>Фотография и оформление</legend>
      {!removePhoto && !photo && <img className="admin-photo" src={imageFor(place)} alt="Текущее изображение"/>}
      <PhotoUpload label="Заменить фотографию" photo={photo} onChange={p => {setPhoto(p); if (p) setRemovePhoto(false);}} onBusy={setReading} onError={setError}/>
      {place.mediaId && <label className="checkbox"><input type="checkbox" checked={removePhoto} onChange={e => {setRemovePhoto(e.target.checked); setPhoto(null);}}/>Убрать фотографию и вернуть иллюстрацию</label>}
      <label>Цвет карточки<select name="accent" defaultValue={place.appearance?.accent || "forest"}><option value="forest">Лесной зелёный</option><option value="river">Речной синий</option><option value="clay">Терракотовый</option></select></label>
      <label>Положение изображения<select name="imagePosition" defaultValue={place.appearance?.imagePosition || "center"}><option value="center">По центру</option><option value="top">Верхняя часть</option><option value="bottom">Нижняя часть</option></select></label>
    </fieldset>
    {error && <div role="alert" className="error full">{error}</div>}
    <div className="review-actions full"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Отмена</button><button className="button primary" disabled={busy || reading}>{busy ? "Сохраняем…" : "Сохранить"}</button></div>
  </form>;
}
