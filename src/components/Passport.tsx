import { useState } from "react";
import { FileText, ArrowUpRight } from "lucide-react";
import type { ObjectPassport } from "../types";
const fields: {
  key: Exclude<keyof ObjectPassport, "references">;
  label: string;
  max: number;
}[] = [
  { key: "officialName", label: "Официальное название объекта", max: 300 },
  { key: "objectType", label: "Вид объекта", max: 200 },
  { key: "period", label: "Датировка по паспорту", max: 300 },
  { key: "address", label: "Адрес или местоположение", max: 1000 },
  { key: "condition", label: "Состояние объекта", max: 1000 },
  { key: "protectionStatus", label: "Охранный статус", max: 1000 },
  { key: "documentTitle", label: "Название документа-источника", max: 250 },
  { key: "documentDate", label: "Дата документа", max: 100 },
  { key: "archiveReference", label: "Архивный шифр или страница", max: 1000 },
  { key: "documentUrl", label: "Ссылка на паспорт (HTTPS)", max: 2000 },
];
export function readPassport(values: Record<string, FormDataEntryValue>) {
  const data = Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => key !== "includePassport" && !key.startsWith("passport_"),
    ),
  );
  const passport =
    values.includePassport === "on"
      ? (Object.fromEntries(
          fields
            .map((f) => [
              f.key,
              String(values[`passport_${f.key}`] || "").trim(),
            ])
            .filter(([, value]) => value),
        ) as unknown as ObjectPassport)
      : null;
  return { ...data, passport };
}
export function PassportFields({
  initial,
}: {
  initial?: ObjectPassport | null;
}) {
  const [enabled, setEnabled] = useState(Boolean(initial));
  return (
    <fieldset className="passport-fields full">
      <legend>
        <FileText size={16} />
        Сведения из паспорта объекта
      </legend>
      <label className="checkbox">
        <input
          name="includePassport"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Есть документ-источник: добавить его сведения в карточку</span>
      </label>
      {enabled && (
        <>
          <p className="passport-help">
            Переносите только сведения, которые есть в документе. Неизвестные
            поля оставьте пустыми. Не добавляйте частные контакты и личные
            документы.
          </p>
          <div className="passport-fields-grid">
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  name={`passport_${f.key}`}
                  aria-label={f.label}
                  defaultValue={initial?.[f.key] || ""}
                  maxLength={f.max}
                  required={f.key === "documentTitle"}
                  minLength={f.key === "documentTitle" ? 3 : undefined}
                  type={f.key === "documentUrl" ? "url" : "text"}
                  pattern={f.key === "documentUrl" ? "https://.*" : undefined}
                  placeholder={
                    f.key === "documentUrl" ? "https://…" : undefined
                  }
                />
              </label>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
export function PassportCard({
  passport,
}: {
  passport?: ObjectPassport | null;
}) {
  if (!passport) return null;
  const extra: typeof fields = [
    { key: "economy", label: "Хозяйство по паспорту", max: 5000 },
    { key: "population", label: "Население по паспорту", max: 5000 },
    { key: "historicalStatus", label: "Исторический статус", max: 1000 },
    { key: "coordinateNote", label: "Достоверность местоположения", max: 1000 },
  ];
  const rows = [...fields.slice(0, 6), ...extra].filter((f) =>
    passport[f.key]?.trim(),
  );
  const url = passport.documentUrl?.startsWith("https://")
    ? passport.documentUrl
    : null;
  return (
    <section className="passport-card" aria-label="Паспорт объекта">
      <div className="passport-heading">
        <FileText size={22} />
        <div>
          <span className="eyebrow">СВЕДЕНИЯ ИЗ ДОКУМЕНТА</span>
          <h3>Паспорт объекта</h3>
        </div>
      </div>
      {rows.length > 0 && (
        <dl>
          {rows.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>{passport[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="passport-source">
        <strong>Документ-источник</strong>
        <p>{passport.documentTitle}</p>
        {passport.documentDate && (
          <p>Дата документа: {passport.documentDate}</p>
        )}
        {passport.archiveReference && (
          <p>Шифр / страница: {passport.archiveReference}</p>
        )}
        {passport.references?.length ? (
          <details className="passport-references">
            <summary>
              Источники, указанные в паспорте
            </summary>
            <ul>
              {passport.references.map((reference, i) => (
                <li key={i}>{reference}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url.includes("/drive/folders/")
              ? "Открыть папку источника"
              : "Открыть паспорт"}{" "}
            <ArrowUpRight size={14} />
          </a>
        )}
      </div>
    </section>
  );
}
