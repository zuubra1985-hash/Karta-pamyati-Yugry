import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import type { Place } from "../types";
export default function MemoryMap({
  places,
  selected,
  onSelect,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (p: Place) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const tile = useRef<L.TileLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  const [osm, setOsm] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [showHypotheses, setShowHypotheses] = useState(false);
  const mapped = useMemo(
    () =>
      places.filter(
        (p): p is Place & { latitude: number; longitude: number } =>
          p.latitude !== null &&
          p.longitude !== null &&
          (p.coordinateStatus !== "hypothesis" || showHypotheses),
      ),
    [places, showHypotheses],
  );
  onSelectRef.current = onSelect;
  useEffect(() => {
    const instance = L.map(container.current!, {
      center: [62.1, 69.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
    });
    L.imageOverlay(
      "/images/map.svg",
      [
        [58, 58],
        [67, 86],
      ],
      { opacity: 1, interactive: false },
    ).addTo(instance);
    instance.attributionControl.setPrefix(false);
    instance.attributionControl.addAttribution(
      "Авторская схема · не для навигации",
    );
    L.control
      .scale({ imperial: false, position: "bottomleft" })
      .addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    instance.fitBounds(
      [
        [59.4, 60.2],
        [64.9, 77.6],
      ],
      { padding: [35, 35] },
    );
    const observer = new ResizeObserver(() => {
      instance.invalidateSize();
      instance.fitBounds(
        [
          [59.4, 60.2],
          [64.9, 77.6],
        ],
        { padding: [35, 45], animate: false },
      );
    });
    observer.observe(container.current!);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const group = markers.current;
    if (!group) return;
    group.clearLayers();
    mapped.forEach((p) => {
      // Marker markup contains only constant icons. User strings are text nodes.
      const icon = L.divIcon({
        className: "memory-pin-container",
        html: `<span class="memory-pin ${p.coordinateStatus === "hypothesis" ? "hypothesis" : ""} ${p.id === selected ? "active" : ""}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20V9l8-5 8 5v11M8 20v-7h8v7M2 20h20M9 8h6"/></svg></span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 40],
      });
      const marker = L.marker([p.latitude, p.longitude], {
        icon,
        title: p.title,
        alt: p.title,
        keyboard: true,
      }).addTo(group);
      marker.on("click", () => onSelectRef.current(p));
      const label = document.createElement("span");
      label.textContent = p.catalogue ? p.title : p.location;
      marker.bindTooltip(label, {
        permanent: p.coordinateStatus !== "hypothesis",
        direction: p.id === "megion" ? "top" : "bottom",
        offset: p.id === "megion" ? [0, -35] : [0, 5],
        className: "place-map-label",
      });
    });
  }, [mapped, selected]);
  useEffect(() => {
    if (showHypotheses && mapped.length)
      map.current?.fitBounds(
        L.latLngBounds(mapped.map((p) => [p.latitude, p.longitude])),
        { padding: [45, 45], maxZoom: 9 },
      );
  }, [showHypotheses, mapped]);
  useEffect(() => {
    const p = mapped.find((p) => p.id === selected);
    if (
      p &&
      map.current &&
      !map.current.getBounds().contains([p.latitude, p.longitude])
    )
      map.current.panTo([p.latitude, p.longitude]);
  }, [selected, mapped]);
  useEffect(() => {
    if (!map.current) return;
    if (osm) {
      tile.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map.current);
      tile.current.on("tileerror", () => setTileError(true));
    } else {
      tile.current?.remove();
      tile.current = null;
      setTileError(false);
    }
    return () => {
      tile.current?.remove();
      tile.current = null;
    };
  }, [osm]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="memory-map"
        role="region"
        aria-label="Интерактивная карта памятных мест Югры"
      />
      <div className="map-caption">
        <span className="live-dot" />{" "}
        {osm ? "OpenStreetMap" : "Югра · карта воспоминаний"}
      </div>
      {places.some((p) => p.coordinateStatus === "hypothesis") && (
        <div className="hypothesis-controls">
          <button
            aria-pressed={showHypotheses}
            onClick={() => setShowHypotheses((v) => !v)}
          >
            {showHypotheses ? "Скрыть гипотезы" : "Показать гипотезы"} ·{" "}
            {places.filter((p) => p.coordinateStatus === "hypothesis").length}
          </button>
          <span>
            {showHypotheses
              ? "G1 / P0 · не для навигации"
              : "Точки не подтверждены. Карточки доступны в списке."}
          </span>
        </div>
      )}
      <div className="map-controls">
        <button
          aria-label="Приблизить карту"
          onClick={() => map.current?.zoomIn()}
        >
          <Plus size={19} />
        </button>
        <button
          aria-label="Отдалить карту"
          onClick={() => map.current?.zoomOut()}
        >
          <Minus size={19} />
        </button>
        <span />
        <button
          aria-label="Показать все места"
          onClick={() => {
            if (mapped.length)
              map.current?.fitBounds(
                L.latLngBounds(mapped.map((p) => [p.latitude, p.longitude])),
                { padding: [45, 45], maxZoom: 9 },
              );
          }}
        >
          <LocateFixed size={19} />
        </button>
      </div>
      <button
        className="map-layer"
        onClick={() => setOsm((v) => !v)}
        aria-pressed={osm}
      >
        <Layers size={16} />
        {osm ? "Авторская схема" : "Карта OSM"}
      </button>
      {tileError && (
        <div className="map-warning" role="status">
          Подложка OSM недоступна.{" "}
          <button onClick={() => setOsm(false)}>Показать схему</button>
        </div>
      )}
      <div className="map-legend">
        <span className="legend-pin" /> Место с историей{" "}
        <span className="legend-line" /> Реки
      </div>
    </div>
  );
}
