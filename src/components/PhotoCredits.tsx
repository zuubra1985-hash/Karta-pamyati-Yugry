import type { PhotoCredit } from "../types";

const fields = [
  ["photographer", "Фотограф"], ["date", "Дата съёмки"],
  ["source", "Источник фотографии"], ["rights", "Основание использования"],
] as const;

export function readPhotoCredit(values: Record<string, FormDataEntryValue>, prefix = "photoCredit"): PhotoCredit {
  return Object.fromEntries(fields.map(([key]) => [key, String(values[`${prefix}_${key}`] || (prefix === "afterPhotoCredit" ? key === "date" ? values.afterYear : key === "source" ? values.afterSource : "" : "") || "").trim()]));
}

export function PhotoCreditFields({initial, prefix = "photoCredit", title = "Описание и права на фотографию", second = false}: {
  initial?: PhotoCredit; prefix?: string; title?: string; second?: boolean;
}) {
  return <fieldset className="full passport-fields photo-credit-fields"><legend>{title}</legend>
    <p className="passport-help">Укажите сведения именно об этом снимке. Неизвестные данные оставьте пустыми. В основании использования укажите своё авторство, разрешение правообладателя или лицензию. Один источник исторического текста не подтверждает права на фото.</p>
    <div className="passport-fields-grid">{fields.filter(([key]) => !second || (key !== "date" && key !== "source")).map(([key, label]) => <label key={key}>{label}<input
      name={`${prefix}_${key}`} defaultValue={initial?.[key] || ""} maxLength={1000}
      placeholder={key === "rights" ? "Например: собственный снимок; разрешение автора от…; CC BY 4.0" : "Если известно"}/></label>)}</div>
  </fieldset>;
}

export default function PhotoCredits({credit, title = "Сведения о фотографии"}: {credit?: PhotoCredit; title?: string}) {
  return <section className="photo-credits" aria-label={title}><h3>{title}</h3><dl>
    {fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{credit?.[key]?.trim() || (key === "rights" ? "Основание использования не указано" : "Не установлено")}</dd></div>)}
  </dl>{!credit?.rights?.trim() && <p className="small muted">Сведения о правах требуют уточнения у предоставившего снимок. Общие права проекта не распространяются автоматически на эту фотографию.</p>}</section>;
}
