import { useEffect, useState } from "react";
import { Search, Pencil, History, ArrowLeft, RefreshCw, MapPin, Image, BookOpen } from "lucide-react";
import { api, categories, categoryLabel, dateFor, imageFor, type Place } from "../types";
import EditPlace from "./EditPlace";
import { PassportCard } from "./Passport";

type PlaceEdit = {placeId: string; revision: number; editor: string; createdAt: string; before: Place; after: Place};
const labels: Record<string, string> = {title:"Название", location:"Поселение", category:"Тема", year:"Год", dateLabel:"Датировка", summary:"Краткое описание", story:"Текст", author:"Автор", source:"Источник", latitude:"Широта", longitude:"Долгота", coordinateStatus:"Достоверность GPS", passport:"Паспорт", appearance:"Оформление", mediaId:"Фотография", afterMediaId:"Второй снимок", afterSource:"Источник второго снимка", afterYear:"Год второго снимка"};
function value(key: string, data: unknown) {
  if (data === undefined || data === null || data === "") return "Не указано";
  if (key === "category") return categoryLabel(String(data));
  if (key === "coordinateStatus") return ({unknown:"Не установлено", hypothesis:"Приблизительно", confirmed:"Уточнено"})[String(data)] || String(data);
  if (key === "mediaId" || key === "afterMediaId") return "Фотография загружена";
  if (key === "appearance") { const a = data as NonNullable<Place["appearance"]>; return `${({forest:"Лесной зелёный", river:"Речной синий", clay:"Терракотовый"})[a.accent]} · ${({center:"По центру",top:"Верхняя часть",bottom:"Нижняя часть"})[a.imagePosition]}`; }
  return String(data);
}
function HistoryValue({field, place}: {field: string; place: Place}) {
  if (field === "passport") return place.passport ? <PassportCard passport={place.passport}/> : <p>Паспорт не указан</p>;
  if (field === "mediaId" || field === "afterMediaId") {
    const id = field === "mediaId" ? place.mediaId : place.afterMediaId;
    return id ? <img className="admin-history-photo" src={`/api/media/${encodeURIComponent(id)}`} alt="Фотография этой версии"/> : <p>Фотография не загружена</p>;
  }
  return <p>{value(field, place[field as keyof Place])}</p>;
}
export function AdminHistory({placeId}: {placeId?: string}) {
  const [edits,setEdits]=useState<PlaceEdit[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState("");
  async function load() {
    setLoading(true); setError("");
    try {setEdits(await api<PlaceEdit[]>(placeId ? `/api/admin/places/${encodeURIComponent(placeId)}/history` : "/api/admin/place-edits"));}
    catch(e){setError((e as Error).message);} finally {setLoading(false);}
  }
  useEffect(()=>{void load();},[placeId]);
  return <section className="admin-history" aria-label="Журнал изменений карточек">
    <div className="admin-section-heading"><div><h3>Журнал изменений</h3><p className="muted small">Последние 100 правок опубликованных карточек. Предыдущие версии доступны для сравнения.</p></div><button className="button secondary" disabled={loading} onClick={()=>void load()} aria-label="Обновить журнал"><RefreshCw size={16}/></button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">Загружаем журнал…</p> : !edits.length && !error ? <div className="empty"><History size={30}/><h3>Правок пока нет</h3><p>После сохранения карточки здесь появятся автор и содержание изменений.</p></div> : edits.map(edit=><details className="admin-history-entry" key={`${edit.placeId}-${edit.revision}`}>
      <summary><strong>{edit.after.title}</strong><span>Версия {edit.revision} · {new Date(edit.createdAt).toLocaleString("ru-RU",{timeZone:"Asia/Yekaterinburg"})} (Екатеринбург)</span><small>{edit.editor}</small></summary>
      <div className="admin-diff">{Object.keys(labels).filter(key=>JSON.stringify(edit.before[key as keyof Place])!==JSON.stringify(edit.after[key as keyof Place])).map(key=><section key={key}><h4>{labels[key]}</h4><div className="edit-history-versions"><div><strong>До</strong><HistoryValue field={key} place={edit.before}/></div><div><strong>После</strong><HistoryValue field={key} place={edit.after}/></div></div></section>)}</div>
    </details>)}
  </section>;
}
export default function AdminCatalogue({onSaved}: {onSaved:()=>void}) {
  const [places,setPlaces]=useState<Place[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [search,setSearch]=useState(""),[category,setCategory]=useState("all"),[quality,setQuality]=useState("all");
  const [editing,setEditing]=useState<Place|null>(null),[history,setHistory]=useState<Place|null>(null),[notice,setNotice]=useState("");
  async function load() {setLoading(true);setError("");try{setPlaces(await api<Place[]>("/api/places"));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  if(editing)return <div><EditPlace key={`${editing.id}-${editing.revision || 0}`} place={editing} onCancel={()=>setEditing(null)} onSaved={saved=>{setPlaces(items=>items.map(p=>p.id===saved.id?saved:p));setEditing(null);setNotice(`«${saved.title}»: изменения сохранены.`);onSaved();}}/></div>;
  if(history)return <div><button className="text-button" onClick={()=>setHistory(null)}><ArrowLeft size={16}/>К списку карточек</button><h3>{history.title}</h3><AdminHistory placeId={history.id}/></div>;
  const filtered=places.filter(p=>`${p.title} ${p.location} ${p.id}`.toLocaleLowerCase("ru").replaceAll("ё","е").includes(search.trim().toLocaleLowerCase("ru").replaceAll("ё","е"))&&(category==="all"||p.category===category)&&(quality==="all"||(quality==="gps"&&(p.latitude===null||p.longitude===null))||(quality==="photos"&&!p.mediaId)||(quality==="passport"&&!p.passport)));
  return <section aria-label="Управление карточками">
    <div className="admin-stats"><div><BookOpen size={18}/><strong>{places.length}</strong><span>Карточек в архиве</span></div><div><Image size={18}/><strong>{places.filter(p=>p.mediaId).length}</strong><span>С фотографиями</span></div><div><MapPin size={18}/><strong>{places.filter(p=>p.latitude===null||p.longitude===null).length}</strong><span>Без координат</span></div></div>
    <div className="admin-section-heading"><div><h3>Паспорта и истории</h3><p className="muted small">Редактируйте текст, паспорт, фото, GPS и оформление прямо в кабинете.</p></div><button className="button secondary" aria-label="Обновить карточки" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/></button></div>
    <div className="admin-filters"><label><span><Search size={14}/>Поиск карточек</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Название, поселение или номер"/></label><label>Тема карточек<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Все темы</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Проверить наполнение<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="all">Все карточки</option><option value="gps">Без координат</option><option value="photos">Без фотографий</option><option value="passport">Без паспорта</option></select></label></div>
    {notice&&<p role="status" className="editor-notice">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">Загружаем карточки…</p> : <><p className="muted small">Найдено: {filtered.length} из {places.length}</p>{!filtered.length&&<div className="empty"><h3>Карточки не найдены</h3><button className="text-button" onClick={()=>{setSearch("");setCategory("all");setQuality("all");}}>Сбросить фильтры</button></div>}<div className="admin-catalogue">{filtered.map(p=><article className="admin-place" key={p.id}><img src={imageFor(p)} alt="" loading="lazy"/><div><span className="eyebrow">{p.id} · {categoryLabel(p.category)}</span><h4>{p.title}</h4><p>{p.location} · {dateFor(p)}</p><div className="admin-tags"><span>{p.passport?"Паспорт есть":"Без паспорта"}</span><span>{p.latitude===null||p.longitude===null?"GPS не установлен":p.coordinateStatus==="hypothesis"?"GPS приблизительный":"GPS указан"}</span><span>{p.mediaId?"Фотография":"Иллюстрация"}</span></div></div><div className="admin-place-actions"><button className="button secondary" onClick={()=>{setEditing(p);setNotice("");}} aria-label={`Изменить: ${p.title}`}><Pencil size={14}/>Изменить</button><button className="text-button" onClick={()=>setHistory(p)} aria-label={`История: ${p.title}`}><History size={14}/>История</button></div></article>)}</div></>}
  </section>;
}
