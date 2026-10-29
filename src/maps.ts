export interface Coordinates { latitude: number; longitude: number }
export interface MapPoint extends Coordinates { id: string; title: string; approximate?: boolean; markerNumber?: number }
export interface MapView { latitude: number; longitude: number; zoom: number }

export function hasCoordinates(value: { latitude: number | null; longitude: number | null }): value is Coordinates {
  return typeof value.latitude === "number" && Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) &&
    value.latitude >= 58 && value.latitude <= 67 && value.longitude >= 58 && value.longitude <= 86;
}

export function parseCoordinate(value: string, axis: "latitude" | "longitude"): number | null {
  let text = value.trim().replace(/−/g, "-");
  const direction = text.match(/(?:[сю]\.?\s*ш\.?|[вз]\.?\s*д\.?|[NSEW])/i)?.[0];
  let sign = 1;
  if (direction) {
    const letter = direction[0].toUpperCase();
    if (axis === "latitude" ? !["С", "Ю", "N", "S"].includes(letter) : !["В", "З", "E", "W"].includes(letter)) return null;
    if (["Ю", "З", "S", "W"].includes(letter)) sign = -1;
    text = text.replace(direction, "").trim();
  }
  let result: number;
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) result = Number(text.replace(",", "."));
  else {
    const match = text.match(/^([+-]?\d{1,3})\s*[°º]\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′’]\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*(?:["″”]|''))?\s*$/);
    if (!match) return null;
    const degrees = Number(match[1]), minutes = Number((match[2] || "0").replace(",", ".")), seconds = Number((match[3] || "0").replace(",", "."));
    if (minutes >= 60 || seconds >= 60) return null;
    result = (Math.abs(degrees) + minutes / 60 + seconds / 3600) * (degrees < 0 ? -1 : 1);
  }
  if (direction && result < 0 && sign > 0) return null;
  result = Math.abs(result) * (direction ? sign : result < 0 ? -1 : 1);
  const [min, max] = axis === "latitude" ? [58, 67] : [58, 86];
  return Number.isFinite(result) && result >= min && result <= max ? Number(result.toFixed(8)) : null;
}

export function parseCoordinates(text: string): Coordinates | null {
  const number = "([+-]?\\d{1,3}(?:[.,]\\d+)?)";
  const decimal = text.trim().replace(/^[[(]\s*|\s*[\])]$/g, "").match(new RegExp(`^${number}\\s*[,;]\\s*${number}$`)) ||
    text.trim().match(new RegExp(`^${number}\\s+${number}$`));
  let parts: string[] | null = decimal ? [decimal[1], decimal[2]] : null;
  if (!parts) {
    const angles = text.match(/[+-]?\d{1,3}\s*[°º][^°º]*?(?=[+-]?\d{1,3}\s*[°º]|$)/g);
    if (angles?.length === 2) parts = angles.map((p) => p.trim().replace(/[,;\s]+$/g, ""));
  }
  if (!parts) return null;
  const latitude = parseCoordinate(parts[0], "latitude"), longitude = parseCoordinate(parts[1], "longitude");
  return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

export function readCoordinates(values: Record<string, FormDataEntryValue>): Coordinates {
  const latitude = parseCoordinate(String(values.latitude || ""), "latitude");
  const longitude = parseCoordinate(String(values.longitude || ""), "longitude");
  if (latitude === null || longitude === null)
    throw new Error("Укажите широту от 58 до 67 и долготу от 58 до 86. Порядок: широта, долгота.");
  return { latitude, longitude };
}

export function fitMapView(points: Coordinates[], width = 800, height = 470): MapView {
  if (!points.length) return { latitude: 61.25, longitude: 73.4, zoom: 6 };
  if (points.length === 1) return { ...points[0], zoom: 13 };
  const xs = points.map((p) => (p.longitude + 180) / 360);
  const ys = points.map((p) => (1 - Math.asinh(Math.tan(p.latitude * Math.PI / 180)) / Math.PI) / 2);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const zoom = Math.floor(Math.log2(Math.min(Math.max(160, width - 100) / (256 * Math.max(maxX - minX, .00001)), Math.max(120, height - 100) / (256 * Math.max(maxY - minY, .00001)))));
  return { latitude: Math.atan(Math.sinh(Math.PI * (1 - minY - maxY))) * 180 / Math.PI, longitude: (minX + maxX) * 180 - 180, zoom: Math.max(4, Math.min(15, zoom)) };
}

export function yandexMapUrl(points: MapPoint[], view: MapView, widget = true): string {
  const url = new URL(widget ? "https://yandex.ru/map-widget/v1/" : "https://yandex.ru/maps/");
  // Yandex uses longitude, latitude; our records and form always use latitude, longitude.
  url.searchParams.set("ll", `${view.longitude},${view.latitude}`);
  url.searchParams.set("z", String(view.zoom));
  url.searchParams.set("l", "map");
  if (points.length) url.searchParams.set("pt", points.slice(0, 100).map((p) => `${p.longitude},${p.latitude}`).join("~"));
  return url.href;
}

export function googleMapUrl(point: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`;
}
