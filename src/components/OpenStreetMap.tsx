import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Minus, Plus } from "lucide-react";
import type { Place } from "../types";
import type { Coordinates } from "../maps";
type Point = Place & Coordinates & { markerNumber: number };

export default function OpenStreetMap({ points, selected, onSelect, searchPoint }: { points: Point[]; selected: string | null; onSelect: (p: Place) => void; searchPoint: Coordinates | null }) {
  const container = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), markers = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  onSelectRef.current = onSelect;
  useEffect(() => {
    const instance = L.map(container.current!, { center: [61.25, 73.4], zoom: 7, minZoom: 3, maxZoom: 18, zoomControl: false, zoomAnimation: false, scrollWheelZoom: false });
    const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(instance);
    tile.on("tileerror", () => setTileError(true));
    tile.on("loading", () => setTileError(false));
    instance.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(container.current!);
    return () => { observer.disconnect(); tile.off(); instance.remove(); map.current = null; markers.current = null; };
  }, []);
  useEffect(() => {
    const group = markers.current, instance = map.current;
    if (!group || !instance) return;
    group.clearLayers();
    for (const point of points) {
      const pin = document.createElement("span");
      pin.className = `memory-pin ${point.coordinateStatus === "hypothesis" ? "hypothesis" : ""} ${point.id === selected ? "active" : ""}`;
      const number = document.createElement("b"); number.textContent = String(point.markerNumber); pin.append(number);
      const icon = L.divIcon({ className: "memory-pin-container", html: pin, iconSize: [36, 44], iconAnchor: [18, 40] });
      const marker = L.marker([point.latitude, point.longitude], { icon, title: point.title, alt: point.title, keyboard: true }).addTo(group);
      const label = document.createElement("span"); label.textContent = point.title;
      marker.bindTooltip(label, { direction: "top", offset: [0, -34] });
      marker.on("click", () => onSelectRef.current(point));
    }
    const focused = points.find((p) => p.id === selected);
    if (searchPoint) {
      const icon = L.divIcon({ className: "memory-pin-container", html: '<span class="memory-pin active"><b>●</b></span>', iconSize: [36, 44], iconAnchor: [18, 40] });
      L.marker([searchPoint.latitude, searchPoint.longitude], { icon, title: "Введённая точка" }).addTo(group).bindTooltip("Введённая точка");
      instance.setView([searchPoint.latitude, searchPoint.longitude], 13, { animate: false });
    }
    else if (focused) instance.setView([focused.latitude, focused.longitude], 13, { animate: false });
    else if (points.length) instance.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), { padding: [35, 35], maxZoom: 12, animate: false });
    else instance.setView([61.25, 73.4], 6, { animate: false });
  }, [points, selected, searchPoint]);
  return <>
    <div ref={container} className="memory-map" />
    <div className="map-controls"><button aria-label="Приблизить карту" onClick={() => map.current?.zoomIn()}><Plus size={19} /></button><button aria-label="Отдалить карту" onClick={() => map.current?.zoomOut()}><Minus size={19} /></button></div>
    {tileError && <div className="map-warning" role="status">Картографическая подложка недоступна. Можно выбрать Яндекс Карты.</div>}
  </>;
}
