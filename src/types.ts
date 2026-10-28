export type Category =
  | "architecture"
  | "settlements"
  | "people"
  | "culture"
  | "nature";
export interface Place {
  id: string;
  title: string;
  location: string;
  category: Category;
  year: number;
  latitude: number;
  longitude: number;
  summary: string;
  story: string;
  author: string;
  source: string;
  image: string;
  demo: boolean;
  mediaId?: string;
}
export interface Submission extends Omit<Place, "demo" | "image" | "summary"> {
  contact: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reason?: string;
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
