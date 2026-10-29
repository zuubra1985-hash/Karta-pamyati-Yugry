import { ArrowUpRight, Quote } from "lucide-react";
import type { ResidentMemory } from "../types";

export default function ResidentMemories({ memories, onPlace, placeTitles }: {
  memories: ResidentMemory[];
  onPlace?: (id: string) => void;
  placeTitles?: Map<string, string>;
}) {
  if (!memories.length) return null;
  return <section className="resident-memories" aria-label="Воспоминания жителей">
    <div className="resident-memories-heading"><Quote size={23} /><div><span className="eyebrow">ЛИЧНЫЕ СВИДЕТЕЛЬСТВА</span><h3>Воспоминания жителей</h3></div></div>
    <div className="memoir-grid">
      {memories.map((memory) => <article className="memoir-card" key={memory.id}>
        <span className="memoir-period">{memory.period}</span>
        <h4>{memory.title}</h4>
        <p className="memoir-narrator">{memory.narrator}</p>
        {memory.quote && <blockquote><p>«{memory.quote}»</p><cite>Из опубликованного воспоминания</cite></blockquote>}
        <div className="memoir-summary"><span>Краткий пересказ</span>{memory.summary.split("\n\n").map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
        {onPlace && placeTitles && <div className="memoir-places">{memory.placeIds.filter((id) => placeTitles.has(id)).map((id) => <button key={id} onClick={() => onPlace(id)}>{placeTitles.get(id)} <ArrowUpRight size={13} /></button>)}</div>}
        <div className="memoir-source"><strong>{memory.source.publisher}</strong><a href={memory.source.url} target="_blank" rel="noopener noreferrer">{memory.source.title} <ArrowUpRight size={14} /></a></div>
      </article>)}
    </div>
  </section>;
}
