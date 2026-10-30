import { useEffect, useId, useRef, useState } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import { parseCoordinates, yandexMapUrl } from "../maps";

const invalidMessage = "Укажите пару координат: сначала широту от 58 до 67, затем долготу от 58 до 86. Например: 61.24, 73.4.";
export default function CoordinatesFields({ initial, editorial = false }: {
  initial?: { latitude: number; longitude: number };
  editorial?: boolean;
}) {
  const [value, setValue] = useState(initial ? `${initial.latitude}, ${initial.longitude}` : "");
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const parsed = parseCoordinates(value);
  const latitude = parsed?.latitude, longitude = parsed?.longitude;
  const invalid = Boolean(value.trim()) && !parsed;
  const [preview, setPreview] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    input.current?.setCustomValidity(invalid ? invalidMessage : "");
  }, [invalid]);
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) { setPreview(null); return; }
    const timer = setTimeout(() => setPreview({ latitude, longitude }), 350);
    return () => clearTimeout(timer);
  }, [latitude, longitude]);
  const view = preview && preview.latitude === latitude && preview.longitude === longitude ? {...preview, zoom:13} : null;
  return <fieldset className="coordinates-fields full">
    <legend><MapPin size={17}/>Местоположение</legend>
    <label htmlFor={id}>{editorial ? "Координаты материала" : "Координаты объекта"}</label>
    <input id={id} ref={input} className="coordinate-pair-input" value={value} required
      aria-describedby={`${id}-help${touched && invalid ? ` ${id}-error` : ""}`}
      aria-invalid={touched && invalid ? true : undefined}
      placeholder="61.2408, 73.4072"
      onBlur={() => setTouched(true)}
      onChange={e => {
        setValue(e.target.value);
        e.target.setCustomValidity(e.target.value.trim() && !parseCoordinates(e.target.value) ? invalidMessage : "");
      }}/>
    <p id={`${id}-help`}>Введите или вставьте одну пару: широта, долгота. Можно скопировать координаты с карты или из паспорта, в том числе в градусах, минутах и секундах.</p>
    <input type="hidden" name="latitude" value={latitude ?? ""}/>
    <input type="hidden" name="longitude" value={longitude ?? ""}/>
    {touched && invalid && <p className="error" id={`${id}-error`} role="alert">{invalidMessage}</p>}
    {view && <div className="coordinate-preview">
      <iframe title="Предпросмотр координат на Яндекс Картах" src={yandexMapUrl([{...view,id:"preview",title:"Выбранное место"}],view)} loading="lazy" allowFullScreen/>
      <a href={yandexMapUrl([{...view,id:"preview",title:"Выбранное место"}],view,false)} target="_blank" rel="noopener noreferrer">Проверить точку в Яндекс Картах <ArrowUpRight size={14}/></a>
    </div>}
  </fieldset>;
}
