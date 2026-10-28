import { History, RotateCcw } from "lucide-react";
import type { Place } from "../types";
export default function Timeline({
  places,
  value,
  onChange,
  onReset,
}: {
  places: Place[];
  value: [number, number] | null;
  onChange: (value: [number, number]) => void;
  onReset: () => void;
}) {
  const dated = places.filter(
    (p): p is Place & { year: number } => p.year !== null,
  );
  const max = new Date().getFullYear();
  const min = Math.min(
    max - 1,
    dated.length
      ? Math.floor(Math.min(...dated.map((p) => p.year)) / 10) * 10
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
          <strong>Память сквозь время</strong>
          <span>Выберите годы историй</span>
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
      <div
        className="timeline-histogram"
        role="img"
        aria-label="Распределение всех историй архива по десятилетиям"
      >
        {buckets.map((b, index) => (
          <div
            key={b.year}
            className={b.year <= to && b.year + 9 >= from ? "within-range" : ""}
            title={`${b.year}-е: ${b.count}`}
          >
            <span
              style={{ height: `${Math.max(3, (b.count / highest) * 32)}px` }}
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
        Без точного года: {places.length - dated.length}. Они доступны при
        выборе всех лет. Фильтр использует год истории. Дата второго снимка
        сравнения на отбор не влияет. Столбцы показывают весь архив.
      </p>
    </section>
  );
}
