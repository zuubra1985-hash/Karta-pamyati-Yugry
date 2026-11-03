import { History, RotateCcw } from "lucide-react";
import { eventFor } from "../history";
import type { Place } from "../types";
export default function Timeline({
  places,
  event,
  onEventChange,
  value,
  onChange,
  onReset,
}: {
  places: Place[];
  event: string;
  onEventChange: (event: string) => void;
  value: [number, number] | null;
  onChange: (value: [number, number]) => void;
  onReset: () => void;
}) {
  const selectedPlaces = places.filter(p => event === "all" || eventFor(p) === event);
  const eventLabels = [...new Set(places.map(eventFor))].sort((a,b) => a.localeCompare(b, "ru"));
  const dated = selectedPlaces.filter(
    (p): p is Place & { year: number } => p.year !== null,
  );
  const max = new Date().getFullYear();
  const min = Math.min(
    max - 1,
    places.some(p => p.year !== null)
      ? Math.floor(Math.min(...places.flatMap(p => p.year === null ? [] : [p.year])) / 10) * 10
      : 1950,
  );
  const from = Math.max(min, value?.[0] ?? min),
    to = Math.min(max, value?.[1] ?? max);
  const firstDecade = Math.floor(min / 10) * 10;
  const buckets = Array.from(
    { length: Math.floor((max - firstDecade) / 10) + 1 },
    (_, i) => {
      const year = firstDecade + i * 10;
      return {
        year,
        count: dated.filter((p) => p.year >= year && p.year < year + 10).length,
      };
    },
  );
  const highest = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <section className="timeline" aria-label="Временная шкала архива">
      <div className="timeline-heading">
        <div>
          <History size={18} />
          <strong>События по годам</strong>
          <span>Год указанного в карточке события</span>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onReset}
          disabled={!value}
        >
          <RotateCcw size={13} />
          Все годы
        </button>
      </div>
      <label className="timeline-event">Тип события<select aria-label="Тип события" value={event} onChange={e => onEventChange(e.target.value)}><option value="all">Все типы событий</option>{eventLabels.map(label => <option key={label} value={label}>{label}</option>)}</select></label>
      <div
        className="timeline-histogram"
        role="img"
        aria-label={`Количество карточек по десятилетиям: ${event === "all" ? "все типы событий" : event}`}
      >
        {buckets.map((b, index) => (
          <div
            key={b.year}
            className={b.year <= to && b.year + 9 >= from ? "within-range" : ""}
            title={`${b.year}-е: ${b.count} карточек. ${[...new Set(dated.filter(p => p.year >= b.year && p.year < b.year + 10).map(eventFor))].join(", ")}`}
          >
            <span
              style={{ height: `${b.count ? Math.max(3, (b.count / highest) * 32) : 0}px` }}
            />
            <small>
              {index === 0 ||
              index === buckets.length - 1 ||
              index % Math.ceil(buckets.length / 8) === 0
                ? b.year
                : "\u00a0"}
            </small>
          </div>
        ))}
      </div>
      <div className="timeline-controls">
        <label>
          От <output>{from}</output>
          <input
            type="range"
            aria-label="Начальный год"
            min={min}
            max={max}
            value={from}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChange([next, Math.max(next, to)]);
            }}
          />
        </label>
        <label>
          До <output>{to}</output>
          <input
            type="range"
            aria-label="Конечный год"
            min={min}
            max={max}
            value={to}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChange([Math.min(next, from), next]);
            }}
          />
        </label>
      </div>
      <p className="timeline-note">
        {event === "all" ? "Здесь собраны разные события, а не только даты основания поселений." : `Показаны только события «${event}».`} Без точного года: {selectedPlaces.length - dated.length}. Эти карточки доступны при выборе всех лет.
      </p>
      <details className="timeline-help"><summary>Как читать шкалу</summary><p>Каждая карточка учитывается по одному основному событию: основанию, переписи, присвоению названия, упразднению или другому событию, указанному рядом с годом. Годы отдельных воспоминаний и даты фотографий могут отличаться. Столбцы учитывают выбранный тип события во всём архиве.</p></details>
    </section>
  );
}
