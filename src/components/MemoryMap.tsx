import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, MapPin, Maximize2 } from "lucide-react";
import { fitMapView, hasCoordinates, parseCoordinates, yandexMapUrl, type Coordinates } from "../maps";
import type { Place } from "../types";
const OpenStreetMap = lazy(() => import("./OpenStreetMap"));

export default function MemoryMap({ places, selected, onSelect, onFocus }: {
  places: Place[];
  selected: string | null;
  onSelect: (place: Place) => void;
  onFocus: (id: string | null) => void;
}) {
  const [provider, setProvider] = useState<"yandex" | "osm">(() => {
    try { return localStorage.getItem("yugra-map-provider") === "osm" ? "osm" : "yandex"; }
    catch { return "yandex"; }
  });
  const [includeApproximate, setIncludeApproximate] = useState(true);
  const [coordinateInput, setCoordinateInput] = useState("");
  const [coordinateError, setCoordinateError] = useState("");
  const [searchPoint, setSearchPoint] = useState<Coordinates | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 470 });
  const numbered = useMemo(() => places
    .filter((p): p is Place & Coordinates => hasCoordinates(p))
    .map((p, i) => ({ ...p, markerNumber: i + 1, approximate: p.coordinateStatus === "hypothesis" })), [places]);
  const points = useMemo(() => numbered.filter((p) => includeApproximate || !p.approximate), [numbered, includeApproximate]);
  const focused = points.find((p) => p.id === selected);
  const displayed = searchPoint ? [{ ...searchPoint, id: "coordinate-search", title: "Введённая точка" }] : focused ? [focused] : points;
  const view = useMemo(() => fitMapView(searchPoint ? [searchPoint] : focused ? [focused] : points, size.width, size.height), [searchPoint, focused, points, size]);
  useEffect(() => { if (selected) setSearchPoint(null); }, [selected]);
  useEffect(() => {
    if (numbered.some((p) => p.id === selected && p.approximate)) setIncludeApproximate(true);
  }, [selected, numbered]);
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  function choose(next: "yandex" | "osm") {
    setProvider(next);
    try { localStorage.setItem("yugra-map-provider", next); } catch { /* The map also works without saved preferences. */ }
  }
  return (
    <div className="map-wrap geographic-map" role="region" aria-label="Интерактивная карта памятных мест Югры">
      <div className="geographic-toolbar">
        <div className="map-providers" aria-label="Сервис карты">
          <button aria-pressed={provider === "yandex"} onClick={() => choose("yandex")}>Яндекс Карты</button>
          <button aria-pressed={provider === "osm"} onClick={() => choose("osm")}>OpenStreetMap</button>
        </div>
        <button className="map-fit" onClick={() => { setSearchPoint(null); setCoordinateError(""); onFocus(null); }}><Maximize2 size={14} /> Все объекты</button>
      </div>
      <form className="map-coordinate-search" onSubmit={(event) => {
        event.preventDefault();
        const point = parseCoordinates(coordinateInput);
        if (!point) { setCoordinateError("Проверьте координаты: сначала широта, затем долгота. Например: 61.24, 73.4."); return; }
        onFocus(null); setSearchPoint(point); setCoordinateError("");
      }}>
        <label><span className="sr-only">Найти координаты на карте</span><input value={coordinateInput} onChange={(e) => setCoordinateInput(e.target.value)} placeholder="Координаты из паспорта: 61.24, 73.4" /></label>
        <button type="submit">Найти точку</button>
      </form>
      {coordinateError && <p className="map-coordinate-error" role="alert">{coordinateError}</p>}
      <div ref={viewport} className="geographic-viewport">
        {provider === "yandex" ? (
          <iframe className="yandex-map" title="Яндекс Карты — поселения Югры" src={yandexMapUrl(displayed, view)} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <Suspense fallback={<div className="loading">Загружаем карту…</div>}>
            <OpenStreetMap points={points} selected={selected} onSelect={onSelect} searchPoint={searchPoint} />
          </Suspense>
        )}
      </div>
      <div className="geographic-footer">
        <span><MapPin size={14} /> {searchPoint ? "Введённая точка" : focused ? "Выбранное место" : `На карте: ${points.length}`}{!searchPoint && places.length > numbered.length ? ` · без координат: ${places.length - numbered.length}` : ""}</span>
        <a href={yandexMapUrl(displayed, view, false)} target="_blank" rel="noopener noreferrer">Открыть в Яндексе <ArrowUpRight size={14} /></a>
      </div>
      {numbered.some((p) => p.approximate) && (
        <label className="map-approximate"><input type="checkbox" checked={includeApproximate} onChange={(e) => {
          setIncludeApproximate(e.target.checked);
          if (!e.target.checked && focused?.approximate) onFocus(null);
        }} /><span>Показывать примерные местоположения <small>Точное положение этих объектов не подтверждено.</small></span></label>
      )}
      {focused && <div className="map-focused-place"><span>{focused.markerNumber}. {focused.title}</span><button onClick={() => onSelect(focused)}>Открыть карточку <ArrowUpRight size={14} /></button></div>}
    </div>
  );
}
