export type Category =
  | "architecture"
  | "settlements"
  | "people"
  | "culture"
  | "nature";
export interface ObjectPassport {
  documentTitle: string;
  documentUrl?: string;
  documentDate?: string;
  archiveReference?: string;
  officialName?: string;
  objectType?: string;
  period?: string;
  address?: string;
  condition?: string;
  protectionStatus?: string;
  economy?: string;
  population?: string;
  historicalStatus?: string;
  coordinateNote?: string;
  references?: string[];
  webSources?: { title: string; url: string; publisher?: string }[];
}
export interface Place {
  id: string;
  revision?: number;
  appearance?: { accent: "forest" | "river" | "clay"; imagePosition: "center" | "top" | "bottom" };
  title: string;
  location: string;
  category: Category;
  year: number | null;
  dateLabel?: string;
  latitude: number | null;
  longitude: number | null;
  summary: string;
  story: string;
  author: string;
  source: string;
  image: string;
  demo: boolean;
  mediaId?: string;
  afterMediaId?: string;
  afterImage?: string;
  afterYear?: number;
  afterSource?: string;
  passport?: ObjectPassport | null;
  catalogue?: string;
  coordinateStatus?: "hypothesis" | "unknown" | "confirmed";
  verificationStatus?: "working" | "verified";
  verification?: { by: "project_owner"; confirmedOn: string };
  memories?: ResidentMemory[];
}
export interface ResidentMemory {
  id: string;
  placeIds: string[];
  narrator: string;
  title: string;
  period: string;
  summary: string;
  quote?: string;
  source: { title: string; url: string; publisher: string };
}
export interface Submission
  extends Omit<
    Place,
    "demo" | "image" | "summary" | "year" | "latitude" | "longitude"
  > {
  year: number;
  latitude: number;
  longitude: number;
  contact: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reason?: string;
  revision: number;
}
export const dateFor = (p: Pick<Place, "year" | "dateLabel">) =>
  p.year === null
    ? "Без точной датировки"
    : `${p.dateLabel ? `${p.dateLabel} · ` : ""}${p.year} г.`;
export interface EditRecord {
  revision: number;
  editor: string;
  createdAt: string;
  before: Submission;
  after: Submission;
}
export interface Photo {
  data: string;
  type: string;
  name: string;
}
export const categories: { id: Category; label: string; short: string }[] = [
  { id: "architecture", label: "Дома и улицы", short: "Архитектура" },
  { id: "settlements", label: "Города и посёлки", short: "Поселения" },
  { id: "people", label: "Люди и судьбы", short: "Люди" },
  { id: "culture", label: "Культура и традиции", short: "Культура" },
  { id: "nature", label: "Природа и память", short: "Природа" },
];
export const categoryLabel = (id: string) =>
  categories.find((c) => c.id === id)?.label || id;
export const imageFor = (p: Pick<Place, "image" | "mediaId">) =>
  p.mediaId
    ? `/api/media/${encodeURIComponent(p.mediaId)}`
    : `/images/${p.image || "river"}.svg`;
export const afterImageFor = (
  p: Pick<Place, "afterMediaId" | "afterImage" | "demo">,
) =>
  p.afterMediaId
    ? `/api/media/${encodeURIComponent(p.afterMediaId)}`
    : p.demo && p.afterImage
      ? `/images/${p.afterImage}.svg`
      : undefined;
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось выполнить запрос.");
  return data;
}
