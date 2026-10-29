import type { Place } from "./types";

const importNotes = new Set([
  "Сведения перенесены из историко-краеведческого паспорта, проверенного владельцем проекта.",
  "Сведения ниже перенесены из рабочего историко-краеведческого паспорта проекта. Они требуют проверки по первоисточникам.",
]);

// Import history stays in the source data; readers see the historical content.
export function publicPlaceContent(place: Place): Place {
  if (!place.catalogue) return place;
  const passport = place.passport;
  const importedDocument = passport?.documentTitle.startsWith("00 ЕДИНЫЙ СВОД — 36 историко-краеведческих паспортов");
  const documentTitle = importedDocument
    ? "Историко-краеведческие паспорта Сургутского района"
    : passport?.documentTitle;
  return {
    ...place,
    story: place.story.split("\n\n").filter((p) => !importNotes.has(p.trim())).join("\n\n"),
    source: importedDocument && place.source.startsWith(passport!.documentTitle)
      ? documentTitle!
      : place.source.replace(/\s*Паспорт проверен владельцем проекта 29 октября 2026 года\.?/g, "").trim(),
    passport: passport ? {
      ...passport,
      documentTitle: documentTitle!,
      archiveReference: /^Паспорт № \d+; раздел III, параметры/.test(passport.archiveReference || "")
        ? undefined
        : passport.archiveReference,
      address: passport.address === "Местоположение не установлено: в рабочем документе смешаны одноимённые объекты."
        ? "Местоположение не установлено."
        : passport.address,
      coordinateNote: /^G1\s*\/\s*P0:/.test(passport.coordinateNote || "")
        ? "Местоположение приблизительное. Не используйте точку для навигации."
        : passport.coordinateNote?.replace(" Прежняя точка не используется.", ""),
    } : passport,
  };
}
