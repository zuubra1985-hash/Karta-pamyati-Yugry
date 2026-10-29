import type { Place } from "./types";

export type ArchiveMode = "server" | "catalogue";

function isPlaceList(data: unknown): data is Place[] {
  return Array.isArray(data) && data.every((p) =>
    p !== null && typeof p === "object" &&
    typeof p.id === "string" && typeof p.title === "string" &&
    typeof p.story === "string" && typeof p.demo === "boolean",
  );
}

async function readPlaces(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Архив недоступен.");
  const places: unknown = await response.json();
  if (!isPlaceList(places)) throw new Error("Неверный формат архива.");
  return places;
}

export async function loadArchive(fetcher: typeof fetch = fetch): Promise<{
  places: Place[];
  mode: ArchiveMode;
}> {
  try {
    return { places: await readPlaces("/api/places", fetcher), mode: "server" };
  } catch {
    // Static hosts publish the catalogue with the site; no database is required.
    // A valid empty server archive stays empty and never restores deleted records.
    try {
      return {
        places: await readPlaces("/catalogue/places.json", fetcher),
        mode: "catalogue",
      };
    } catch {
      throw new Error("Не удалось загрузить паспорта. Проверьте соединение и попробуйте снова.");
    }
  }
}
