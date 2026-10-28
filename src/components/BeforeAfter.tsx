import { useState } from "react";
import { Columns2 } from "lucide-react";
import { afterImageFor, imageFor, type Place } from "../types";
export default function BeforeAfter({
  place,
}: {
  place: Pick<
    Place,
    | "title"
    | "year"
    | "image"
    | "mediaId"
    | "afterMediaId"
    | "afterImage"
    | "afterYear"
    | "afterSource"
    | "demo"
  >;
}) {
  const [position, setPosition] = useState(50);
  const [sideBySide, setSideBySide] = useState(false);
  const after = afterImageFor(place);
  if (!after) return null;
  return (
    <section className="comparison" aria-label="Сравнение тогда и сейчас">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow">ОДНО МЕСТО · ДВА ВЗГЛЯДА</span>
          <h3>Тогда и сейчас</h3>
        </div>
        <button
          type="button"
          className="button secondary"
          aria-pressed={sideBySide}
          onClick={() => setSideBySide((v) => !v)}
        >
          <Columns2 size={15} />
          {sideBySide ? "С разделителем" : "Показать рядом"}
        </button>
      </div>
      <p className="comparison-hint">
        {place.demo
          ? "Две авторские иллюстрации показывают работу сравнения. Это не исторические снимки."
          : "Сравните снимки одного места. Для сопоставления лучше подходят фотографии с похожим ракурсом."}
      </p>
      {sideBySide ? (
        <div className="comparison-pair">
          <figure>
            <img
              src={imageFor(place)}
              alt={`${place.title}, первый снимок, ${place.year} год`}
            />
            <figcaption>Тогда · {place.year}</figcaption>
          </figure>
          <figure>
            <img
              src={after}
              alt={`${place.title}, второй снимок, ${place.afterYear} год`}
            />
            <figcaption>Позже · {place.afterYear}</figcaption>
          </figure>
        </div>
      ) : (
        <>
          <div className="comparison-canvas">
            <img
              className="comparison-after"
              src={after}
              alt={`${place.title}, второй снимок, ${place.afterYear} год`}
            />
            <div
              className="comparison-before"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <img
                src={imageFor(place)}
                alt={`${place.title}, первый снимок, ${place.year} год`}
              />
            </div>
            <span className="comparison-label before-label">
              Тогда · {place.year}
            </span>
            <span className="comparison-label after-label">
              Позже · {place.afterYear}
            </span>
            <span
              className="comparison-divider"
              aria-hidden="true"
              style={{ left: `${position}%` }}
            >
              <span>↔</span>
            </span>
          </div>
          <label className="comparison-slider">
            Положение разделителя <output>{position}%</output>
            <input
              aria-label="Положение разделителя"
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
          </label>
        </>
      )}
      <p className="comparison-source">
        <strong>Источник второго снимка:</strong> {place.afterSource}
      </p>
    </section>
  );
}
