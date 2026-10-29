import memories from "./data/memories.json" with { type: "json" };

// Memoirs supplement existing public places; this never creates or restores a place.
export function withMemories(place) {
  return { ...place, memories: memories.filter((memory) => memory.placeIds.includes(place.id)).map(({ evidence, ...publicMemory }) => publicMemory) };
}
