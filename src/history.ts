import type { Place } from "./types";

// A card's indexed year describes one named event, not necessarily its founding.
export const eventKinds = [
  "Воспоминание", "Возникновение", "Строительство", "Современный посёлок", "Учёт населения",
  "Список поселений", "Присвоение названия", "Упразднение",
  "Начало спецпоселения", "Создание колхоза", "Национальное село",
] as const;
export const otherEvent = "Другое событие / тип не уточнён";
export function eventFor(place: Pick<Place, "dateLabel">) {
  return place.dateLabel?.trim() || otherEvent;
}
export function matchesEvent(place: Pick<Place, "dateLabel">, event: string) {
  return event === "all" || eventFor(place) === event;
}
