import { useEffect, useRef, useState } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import { parseCoordinate, parseCoordinates, yandexMapUrl } from "../maps";

export default function CoordinatesFields({ initial, editorial = false }: {
  initial?: { latitude: number; longitude: number };
  editorial?: boolean;
}) {
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : "");
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : "");
  const [pair, setPair] = useState("");
  const [pairError, setPairError] = useState("");
  const latRef = useRef<HTMLInputElement>(null), lonRef = useRef<HTMLInputElement>(null);
  const lat = parseCoordinate(latitude, "latitude"), lon = parseCoordinate(longitude, "longitude");
  const [preview, setPreview] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    latRef.current?.setCustomValidity(latitude && lat === null ? "Широта должна быть от 58 до 67. Допустимы десятичная запись и градусы, минуты, секунды." : "");
    lonRef.current?.setCustomValidity(longitude && lon === null ? "Долгота должна быть от 58 до 86. Проверьте порядок координат." : "");
    if (lat === null || lon === null) { setPreview(null); return; }
    const timer = setTimeout(() => setPreview({ latitude: lat, longitude: lon }), 350);
    return () => clearTimeout(timer);
  }, [latitude, longitude, lat, lon]);
  const point = preview ? [{ ...preview, id: "preview", title: "Выбранное место" }] : [];
  const view = preview ? { ...preview, zoom: 13 } : null;
  return (
    <fieldset className="coordinates-fields full">
      <legend><MapPin size={17} /> Координаты объекта</legend>
      <p>Вставьте координаты из паспорта или заполните поля. Сначала широта, затем долгота.</p>
      <div className="coordinate-paste">
        <label>Координаты из паспорта
          <input value={pair} onChange={(e) => setPair(e.target.value)} placeholder="61.2408, 73.4072 или 61°14′27″ с. ш., 73°24′26″ в. д." />
        </label>
        <button type="button" className="button secondary" onClick={() => {
          const parsed = parseCoordinates(pair);
          if (!parsed) { setPairError("Не удалось прочитать координаты. Пример: 61.2408, 73.4072. Широта должна идти первой."); return; }
          setLatitude(String(parsed.latitude)); setLongitude(String(parsed.longitude)); setPairError("");
        }}>Применить координаты</button>
      </div>
      {pairError && <p className="error" role="alert">{pairError}</p>}
      <div className="coordinate-inputs">
        <label>{editorial ? "Широта материала" : "Широта"}<input ref={latRef} name="latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} inputMode="decimal" required placeholder="61.2408" /></label>
        <label>{editorial ? "Долгота материала" : "Долгота"}<input ref={lonRef} name="longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} inputMode="decimal" required placeholder="73.4072" /></label>
      </div>
      {view && preview && (
        <div className="coordinate-preview">
          <iframe title="Предпросмотр координат на Яндекс Картах" src={yandexMapUrl(point, view)} loading="lazy" allowFullScreen />
          <a href={yandexMapUrl(point, view, false)} target="_blank" rel="noopener noreferrer">Проверить точку в Яндекс Картах <ArrowUpRight size={14} /></a>
        </div>
      )}
    </fieldset>
  );
}
