import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  Heart,
  MapPin,
  Menu,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import {
  api,
  categories,
  categoryLabel,
  imageFor,
  dateFor,
  type Category,
  type Place,
} from "./types";
import Modal from "./components/Modal";
import SubmissionForm from "./components/SubmissionForm";
import EditPlace from "./components/EditPlace";
import OrganizationDetails from "./components/OrganizationDetails";
import { organization } from "./organization";
import Editor from "./components/Editor";
import { matchesEvent } from "./history";
import PhotoCredits from "./components/PhotoCredits";
import Timeline from "./components/Timeline";
import BeforeAfter from "./components/BeforeAfter";
import { PassportCard } from "./components/Passport";
import { loadArchive, type ArchiveMode } from "./archive";
import { publicPlaceContent } from "./content";
import { googleMapUrl, hasCoordinates, yandexMapUrl } from "./maps";
import ResidentMemories from "./components/ResidentMemories";
const MemoryMap = lazy(() => import("./components/MemoryMap"));
type Page = "map" | "stories" | "memories" | "routes" | "about" | "favorites";
type Route = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  places: string[];
  description: string;
};
type Dialog =
  | { type: "place"; place: Place }
  | { type: "route"; route: Route }
  | { type: "submit"; relatedPlace?: Place }
  | { type: "editor" }
  | null;
const demoRoutes: Route[] = [
  {
    id: "river",
    title: "По берегам памяти",
    subtitle: "РЕКИ И ПОСЕЛЕНИЯ",
    image: "river",
    places: ["samarovo", "berezovo", "konda"],
    description:
      "Цифровое путешествие по историям речных берегов. Это тематическая подборка удалённых друг от друга мест, а не готовый пешеходный или автомобильный маршрут.",
  },
  {
    id: "cities",
    title: "Города из семейных альбомов",
    subtitle: "ЛЮДИ И ПОВСЕДНЕВНОСТЬ",
    image: "village",
    places: ["old-surgut", "megion", "nizhnevartovsk"],
    description:
      "Три города, три повода открыть семейный альбом. Сравните истории знакомых улиц и подумайте, каким материалом вы могли бы дополнить архив. Точки объединены темой, а не навигационным треком.",
  },
  {
    id: "north",
    title: "Там, где начинается Север",
    subtitle: "ПРИРОДА И КУЛЬТУРА",
    image: "forest",
    places: ["saranpaul", "ugut", "berezovo"],
    description:
      "Знакомство с местами через пейзажи и бережный разговор о локальной культуре. Демонстрационная подборка не заменяет подготовку путешествия и разрешения на посещение территорий.",
  },
];
const passportRoutes: Route[] = [
        {
          id: "settlements",
          title: "Исторические слои живых поселений",
          subtitle: "МЕСТО ПРОДОЛЖАЕТ ЖИТЬ",
          image: "village",
          places: ["pas-012", "pas-021", "pas-022", "pas-026", "pas-028", "pas-030"],
          description:
            "Песчаный, Юган, Малоюганский, Тром-Аган, Пасол и Банный продолжают историю поселений края. Здесь собраны рассказы об их прошлом и переменах. Это тематическая подборка для чтения.",
        },
        {
          id: "memory",
          title: "Память обских спецпосёлков",
          subtitle: "ИСТОРИЯ И ИСТОЧНИКИ",
          image: "river",
          places: ["pas-011", "pas-013", "pas-015", "pas-035", "pas-036"],
          description:
            "Паспорта поселений, связанных с историей спецпереселения. Местоположения приблизительные; они не предназначены для навигации.",
        },
        {
          id: "names",
          title: "Старые имена на карте Югры",
          subtitle: "ТОПОНИМЫ И ПРЕЕМСТВЕННОСТЬ",
          image: "forest",
          places: ["pas-003", "pas-005", "pas-009", "pas-024", "pas-033"],
          description:
            "Имена старых деревень и исторических городских территорий. В карточках собраны сведения о названиях, людях и переменах этих мест. Подборка не задаёт путь посещения объектов.",
        },
      ];
const storyNoun = (count: number) => ({one:"история", few:"истории", many:"историй", other:"истории", zero:"историй", two:"истории"})[new Intl.PluralRules("ru").select(count)];
const nav: { id: Page; label: string }[] = [
  { id: "map", label: "Карта мест" },
  { id: "stories", label: "Каталог" },
  { id: "memories", label: "Воспоминания" },
  { id: "routes", label: "Подборки" },
  { id: "about", label: "О проекте" },
];
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`brand-mark ${small ? "small-mark" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 46" fill="none">
        <path
          d="M20 3C10.3 3 4 10 4 19c0 11 16 24 16 24s16-13 16-24C36 10 29.7 3 20 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M11 26V16l9-5 9 5v10M16 26v-8h8v8M9 27h22M17 14h6"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}
export default function App() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => { api("/api/admin/session").then(() => setAdmin(true)).catch(() => {}); }, []);
  const [places, setPlaces] = useState<Place[]>([]);
  const hasCatalogue = places.some((p) => p.catalogue);
  const routes = useMemo(() => (hasCatalogue ? passportRoutes : demoRoutes).map(route => ({...route, places: route.places.filter(id => places.some(p => p.id === id))})).filter(route => route.places.length > 0), [places, hasCatalogue]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [archiveMode, setArchiveMode] = useState<ArchiveMode | null>(null);
  const [page, setPage] = useState<Page>("map");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [decade, setDecade] = useState("all");
  const [event, setEvent] = useState("all");
  const [yearRange, setYearRange] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const v: unknown = JSON.parse(
        localStorage.getItem("yugra-memory-favorites") || "[]",
      );
      return Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [sort, setSort] = useState("editorial");
  const [onlyReal, setOnlyReal] = useState(false);
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const archive = await loadArchive();
      setArchiveMode(archive.mode);
      setPlaces(archive.places);
    } catch (e) {
      setLoadError((e as Error).message);
      setPlaces([]);
      setArchiveMode(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "main") return;
      const originPage = window.history.state?.archivePage;
      if (["map", "stories", "memories", "routes", "about", "favorites"].includes(originPage)) setPage(originPage);
      if (hash === "add") {
        setDialog({type: "submit", relatedPlace: places.find(p => p.id === window.history.state?.relatedPlaceId)});
      } else if (hash === "admin") {
        setDialog({type: "editor"});
      } else if (hash.startsWith("route/")) {
        setPage("routes");
        const route = routes.find(r => r.id === hash.slice(6));
        if (route) setDialog({type:"route", route});
        else if (!loading && !loadError) { setDialog(null); setToast("Эта подборка не найдена."); }
      } else if (hash.startsWith("place/")) {
        const p = places.find((p) => p.id === hash.slice(6));
        if (p) {
          setDialog({ type: "place", place: p });
          setSelected(p.id);
        } else if (!loading && archiveMode === "server") {
          // A shared link may point to a story published after this tab loaded.
          void api<Place>(`/api/places/${encodeURIComponent(hash.slice(6))}`)
            .then((found) => {
              if (window.location.hash.slice(1) === hash) {
                setDialog({ type: "place", place: found });
                setSelected(found.id);
              }
            })
            .catch(() => {
              if (window.location.hash.slice(1) === hash) {
                setDialog(null);
                setToast("Эта история не найдена или пока не опубликована.");
              }
            });
        } else if (!loading && archiveMode === "catalogue") {
          setToast("Этот паспорт не найден в опубликованном архиве.");
        }
      } else {
        setPage(
          (["map", "stories", "memories", "routes", "about", "favorites"].includes(hash)
            ? hash
            : "map") as Page,
        );
        setDialog(null);
        if (hash === "map" && window.history.state?.focusedPlaceId) {
          setSelected(window.history.state.focusedPlaceId);
          window.setTimeout(explore, 0);
        }
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [places, loading, archiveMode, routes, loadError]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
    let result = places.filter((p) => {
      const haystack = `${p.title} ${p.location} ${p.summary} ${p.author}`
        .toLocaleLowerCase("ru")
        .replaceAll("ё", "е");
      return (
        (!query || haystack.includes(query)) &&
        (category === "all" || p.category === category) &&
        (decade === "all" ||
          (p.year !== null &&
            Math.floor(p.year / 10) * 10 === Number(decade))) &&
        (!onlyReal || (hasCatalogue ? Boolean(p.passport) : !p.demo)) &&
        (page !== "favorites" || favorites.includes(p.id))
      );
    });
    if (sort !== "editorial")
      result = [...result].sort(
        (a, b) =>
          Number(a.year === null) - Number(b.year === null) ||
          ((a.year ?? 0) - (b.year ?? 0)) * (sort === "newest" ? -1 : 1),
      );
    return result;
  }, [
    places,
    search,
    category,
    decade,
    sort,
    page,
    favorites,
    onlyReal,
    hasCatalogue,
  ]);
  const decades = [
    ...new Set(
      places.flatMap((p) =>
        p.year === null ? [] : [Math.floor(p.year / 10) * 10],
      ),
    ),
  ].sort((a, b) => a - b);
  const favoriteCount = places.filter((p) => favorites.includes(p.id)).length;
  const memories = useMemo(() => [...new Map(places.flatMap((p) => (p.memories || []).map((memory) => [memory.id, memory] as const))).values()], [places]);
  const placeTitles = useMemo(() => new Map(places.map((p) => [p.id, p.title])), [places]);
  const contributedMemories = useMemo(() => places.filter(p => !p.demo && !p.catalogue), [places]);
  const memoryPlaces = useMemo(() => {
    const ids = new Set(memories.flatMap(memory => memory.placeIds));
    return places.filter(p => ids.has(p.id) || contributedMemories.some(memory => memory.id === p.id));
  }, [places, memories, contributedMemories]);
  const matchingMemoryPlaces = useMemo(() => new Set(memoryPlaces.filter(p => matchesEvent(p, event) && (!yearRange || (p.year !== null && p.year >= yearRange[0] && p.year <= yearRange[1]))).map(p => p.id)), [memoryPlaces, event, yearRange]);
  const filteredMemories = useMemo(() => memories.filter(memory =>
    memory.placeIds.some(id => matchingMemoryPlaces.has(id)) &&
    `${memory.narrator} ${memory.title} ${memory.summary} ${memory.placeIds.map(id => placeTitles.get(id) || "").join(" ")}`.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(search.toLocaleLowerCase("ru").replaceAll("ё", "е").trim())
  ), [memories, matchingMemoryPlaces, placeTitles, search]);
  const filteredContributions = useMemo(() => {
    const query = search.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
    return contributedMemories.filter(p => matchingMemoryPlaces.has(p.id) && `${p.title} ${p.location} ${p.author} ${p.story}`.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(query));
  }, [contributedMemories, matchingMemoryPlaces, search]);
  const mapNumbers = useMemo(() => new Map(filtered.filter((p) => hasCoordinates(p)).map((p, i) => [p.id, i + 1])), [filtered]);
  function navigate(next: Page) {
    window.location.hash = next;
    setPage(next);
    setDialog(null);
    setMenu(false);
    setSearch("");
    setCategory("all");
    setDecade("all");
    setYearRange(null);
    setEvent("all");
    setOnlyReal(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("yugra-memory-favorites", JSON.stringify(next));
    } catch {
      setToast(
        "Избранное изменено, но браузер не разрешил сохранить его на устройстве.",
      );
    }
  }
  function openDialog(next: Exclude<Dialog, null>) {
    const hash = next.type === "place" ? `#place/${next.place.id}` : next.type === "route" ? `#route/${next.route.id}` : next.type === "submit" ? "#add" : "#admin";
    if (window.location.hash !== hash) window.history.pushState({
      archivePage: page, fromArchive: true, returnHash: window.location.hash,
      relatedPlaceId: next.type === "submit" ? next.relatedPlace?.id : undefined,
    }, "", hash);
    setMenu(false);
    setDialog(next);
  }
  function openPlace(place: Place) {
    setSelected(place.id);
    openDialog({type:"place", place});
  }
  function showOnMap(place: Place) {
    setPage("map");
    setDialog(null);
    resetFilters();
    setSelected(place.id);
    setMenu(false);
    const mapState = {archivePage: "map", focusedPlaceId: place.id};
    if (window.location.hash === "#map") window.history.replaceState(mapState, "", "#map");
    else window.history.pushState(mapState, "", "#map");
    window.setTimeout(explore, 0);
  }
  function closeDialog() {
    setDialog(null);
    if (window.history.state?.fromArchive) window.history.back();
    else window.history.replaceState(null, "", `#${page}`);
  }
  function resetFilters() {
    setSearch("");
    setCategory("all");
    setDecade("all");
    setYearRange(null);
    setEvent("all");
    setOnlyReal(false);
  }
  function explore() {
    document
      .getElementById("explore")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    const title = dialog?.type === "place" ? dialog.place.title : dialog?.type === "route" ? dialog.route.title : dialog?.type === "submit" ? "Добавить воспоминание" : dialog?.type === "editor" ? "Кабинет администратора" : page === "favorites" ? "Избранное" : nav.find(item => item.id === page)?.label;
    document.title = `${title || "Архив"} — Карта памяти Югры`;
  }, [page, dialog]);
  const isArchive = ["map", "stories", "favorites"].includes(page);
  return (
    <>
      <a className="skip-link" href="#main" onClick={e => {e.preventDefault(); document.getElementById("main")?.focus(); document.getElementById("main")?.scrollIntoView();}}>
        Перейти к содержимому
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#map"
            onClick={(e) => {
              e.preventDefault();
              navigate("map");
            }}
          >
            <Mark />
            <span>
              КАРТА ПАМЯТИ
              <strong>
                ЮГРЫ<span className="brand-dot">.</span>
              </strong>
            </span>
          </a>
          <nav
            className={`main-nav ${menu ? "open" : ""}`}
            aria-label="Основная навигация"
          >
            {nav.map((n) => (
              <a
                href={`#${n.id}`}
                className={page === n.id ? "active" : ""}
                aria-current={page === n.id ? "page" : undefined}
                key={n.id}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(n.id);
                }}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button className="button secondary admin-entry" title={admin ? "Кабинет администратора" : "Вход администратора"} onClick={() => openDialog({type: "editor"})}><ShieldCheck size={17}/><span>{admin ? "Администратор" : "Вход администратора"}</span></button>
            <button
              className={`icon-button favorites-toggle ${page === "favorites" ? "is-saved" : ""}`}
              onClick={() => navigate("favorites")}
              aria-label={`Избранное, ${favoriteCount} мест`}
            >
              <Heart size={20} />
              {favoriteCount > 0 && <span>{favoriteCount}</span>}
            </button>
            <button
              className="button primary add-top"
              title="Добавить воспоминание"
              onClick={() => openDialog({ type: "submit" })}
            >
              <Plus size={17} />
              <span>Добавить воспоминание</span>
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="research-main" tabIndex={-1}>
        {page === "map" && (
          <section className="research-intro container" aria-labelledby="project-title">
            <div>
              <span className="eyebrow">НАУЧНЫЙ ПРОЕКТ · {organization.shortName}</span>
              <h1 id="project-title">Карта памяти Югры</h1>
              <p>История поселений и воспоминания жителей. Исторические паспорта, картографические сведения и свидетельства о жизни на Севере.</p>
              <div className="hero-actions">
                <button className="button primary" onClick={explore}>Открыть карту <ArrowRight size={17} /></button>
                <button className="text-button" onClick={() => navigate("about")}>О проекте и источниках <ArrowRight size={16} /></button>
              </div>
            </div>
            <aside className="research-overview" aria-label="Состав архива">
              <h2>Состав архива</h2>
              <dl className="hero-facts">
                <div><dt>Карточки материалов</dt><dd>{loading ? "…" : loadError ? "—" : places.length}</dd></div>
                <div><dt>Исторические паспорта</dt><dd>{loading ? "…" : loadError ? "—" : places.filter(p => p.passport).length}</dd></div>
                <div><dt>Воспоминания</dt><dd>{loading ? "…" : loadError ? "—" : memories.length + contributedMemories.length}</dd></div>
              </dl>
              <p>Источники и степень определённости сведений указаны в карточках.</p>
            </aside>
          </section>
        )}
        {page !== "map" && (
          <section className="page-heading container">
            <span className="eyebrow">КАРТА ПАМЯТИ ЮГРЫ</span>
            <h1>
              {page === "stories"
                ? "Каталог материалов"
                : page === "memories"
                  ? "Воспоминания жителей"
                : page === "favorites"
                  ? "Избранные материалы"
                  : page === "routes"
                    ? "Тематические подборки"
                    : "О научном проекте"}
            </h1>
            <p>
              {page === "stories"
                ? "Исторические паспорта поселений и опубликованные материалы участников проекта."
                : page === "memories"
                  ? "Личные воспоминания жителей: опубликованные свидетельства и рассказы участников проекта."
                : page === "favorites"
                  ? "Ваш личный список мест. Сохраняется в этом браузере на этом устройстве."
                  : page === "routes"
                    ? "Тематические подборки историй о местах Югры."
                    : "Задачи проекта, источники, принципы публикации и сведения об организации."}
            </p>
          </section>
        )}
        {isArchive && (
          <section id="explore" className="archive container">
            <div className="section-top">
              <div>
                <span className="eyebrow">
                  {page === "favorites"
                    ? "ЛИЧНАЯ ПОДБОРКА"
                    : "МАТЕРИАЛЫ АРХИВА"}
                </span>
                <h2>
                  {page === "map"
                    ? "Карта поселений"
                    : page === "favorites"
                      ? "Избранные места"
                      : "Материалы и паспорта"}
                </h2>
              </div>
              {page === "map" && (
                <span className="section-aside">
                  <MapPin size={15} /> Ханты-Мансийский автономный округ — Югра
                </span>
              )}
            </div>
            <div className="filters">
              <label className="search-field">
                <Search size={19} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Место, история или имя…"
                  aria-label="Поиск по архиву"
                />
                {search && (
                  <button
                    aria-label="Очистить поиск"
                    onClick={() => setSearch("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <label className="select-filter">
                <SlidersHorizontal size={16} />
                <select
                  aria-label="Тема истории"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Category | "all")
                  }
                >
                  <option value="all">Все темы</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="select-filter decade-select">
                <span className="select-label">Время</span>
                <select
                  aria-label="Десятилетие"
                  value={decade}
                  onChange={(e) => {
                    setDecade(e.target.value);
                    setYearRange(null);
                  }}
                >
                  <option value="all">Все годы</option>
                  {decades.map((y) => (
                    <option value={y} key={y}>
                      {y}-е
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <button
                className={`real-toggle ${onlyReal ? "active" : ""}`}
                aria-pressed={onlyReal}
                onClick={() => setOnlyReal((v) => !v)}
              >
                <Check size={15} />
                {hasCatalogue ? "С паспортом" : "Без примеров"}
              </button>
            </div>
            {!loading && !loadError && <div className="demo-notice">
              <span className="demo-dot" />
              <p>
                {hasCatalogue ? (
                  <>
                    <strong>
                      {places.filter((p) => p.catalogue).length} историй
                      поселений Югры.
                    </strong>{" "}
                    Для точек указана достоверность местоположения. Фотографии и иллюстрации подписаны отдельно.
                  </>
                ) : (
                  <>
                    <strong>Первая глава нашего архива.</strong> Стартовые
                    карточки — демонстрационные примеры, изображения —
                    иллюстрации.
                  </>
                )}
              </p>
              <button onClick={() => openDialog({ type: "submit" })}>
                Добавить свою <ArrowRight size={14} />
              </button>
            </div>}
            {loadError ? (
              <div className="empty error" role="alert">
                <h3>Не удалось загрузить архив</h3>
                <p>{loadError}</p>
                <button className="button secondary" onClick={load}>
                  Попробовать снова
                </button>
              </div>
            ) : loading ? (
              <div className="loading">Собираем истории на карте…</div>
            ) : page === "map" ? (
              <div className="map-layout">
                <div className="places-panel">
                  <div className="places-panel-heading">
                    <strong>
                      Места с историями <span>{filtered.length}</span>
                    </strong>
                    <span>Югра, Россия</span>
                  </div>
                  <div className="place-scroll">
                    {filtered.length ? (
                      filtered.map((p) => (
                        <article
                          key={p.id}
                          className={`mini-card ${selected === p.id ? "selected" : ""}`}
                        >
                          <button
                            className="mini-card-main"
                            onClick={() => openPlace(p)}
                          >
                            <img
                              style={{objectPosition: p.appearance?.imagePosition || "center"}}
                              src={imageFor(p)}
                              alt={
                                p.mediaId ? p.title : "Иллюстрация к истории"
                              }
                              loading="lazy"
                            />
                            <div>
                              <div className="meta">
                                {
                                  categories.find((c) => c.id === p.category)
                                    ?.short
                                }{" "}
                                <span>· {dateFor(p)}</span>
                              </div>
                              <h3>{p.title}</h3>
                              <span className="location">
                                <MapPin size={12} />
                                {p.location}
                              </span>
                            </div>
                          </button>
                          {hasCoordinates(p) && (
                            <button className="mini-card-map" aria-label={`Показать на карте: ${p.title}`} onClick={() => showOnMap(p)}>
                              <MapPin size={12} /> {mapNumbers.get(p.id)}. На карте
                            </button>
                          )}
                          <button
                            className={`card-heart ${favorites.includes(p.id) ? "is-saved" : ""}`}
                            onClick={() => toggleFavorite(p.id)}
                            aria-label={`${favorites.includes(p.id) ? "Убрать из избранного" : "В избранное"}: ${p.title}`}
                            aria-pressed={favorites.includes(p.id)}
                          >
                            <Heart size={16} />
                          </button>
                        </article>
                      ))
                    ) : (
                      <Empty reset={resetFilters} />
                    )}
                  </div>
                  <div className="panel-footnote">
                    <span className="live-dot" /> История ближе, чем кажется
                  </div>
                </div>
                <Suspense
                  fallback={
                    <div className="loading map-loading">
                      Разворачиваем карту…
                    </div>
                  }
                >
                  <MemoryMap
                    places={filtered}
                    selected={selected}
                    onSelect={openPlace}
                    onFocus={setSelected}
                  />
                </Suspense>
              </div>
            ) : (
              <>
                <div className="results-bar">
                  <span role="status">
                    Найдено материалов: <strong>{filtered.length}</strong>
                  </span>
                  <label>
                    Порядок:{" "}
                    <select
                      aria-label="Сортировка историй"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="editorial">Выбор редакции</option>
                      <option value="oldest">Сначала ранние годы</option>
                      <option value="newest">Сначала поздние годы</option>
                    </select>
                  </label>
                </div>
                {filtered.length ? (
                  <div className="story-grid">
                    {filtered.map((p) => (
                      <StoryCard
                        key={p.id}
                        place={p}
                        saved={favorites.includes(p.id)}
                        onFavorite={() => toggleFavorite(p.id)}
                        onOpen={() => openPlace(p)}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    reset={resetFilters}
                    favorites={page === "favorites"}
                    onExplore={() => navigate("map")}
                  />
                )}
              </>
            )}
            {page === "map" && (
              <div className="map-under">
                <span>
                  Не нашли знакомое место? Возможно, его история пока есть
                  только у вас.
                </span>
                <button
                  className="text-button"
                  onClick={() => openDialog({ type: "submit" })}
                >
                  Расскажите о нём <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {page === "map" && !loading && !loadError && places.length > 0 && (
          <section className="featured container">
            <div className="section-top">
              <div>
                <span className="eyebrow">КАТАЛОГ МАТЕРИАЛОВ</span>
                <h2>Карточки поселений</h2>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("stories")}
              >
                Весь каталог <ArrowRight size={17} />
              </button>
            </div>
            <div className="story-grid">
              {places.slice(0, 3).map((p) => (
                <StoryCard
                  key={p.id}
                  place={p}
                  saved={favorites.includes(p.id)}
                  onFavorite={() => toggleFavorite(p.id)}
                  onOpen={() => openPlace(p)}
                />
              ))}
            </div>
          </section>
        )}
        {(page === "memories" || page === "routes") && (loading || loadError) && <section className="container"><div className={loadError ? "empty error" : "loading"} role={loadError ? "alert" : "status"}>{loadError ? <><h2>Не удалось загрузить архив</h2><p>{loadError}</p><button className="button secondary" onClick={load}>Попробовать снова</button></> : "Загружаем архив…"}</div></section>}
        {page === "memories" && !loading && !loadError && (
          <section className="container memoir-page">
            <label className="search-field"><Search size={19} /><input aria-label="Поиск по воспоминаниям" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Рассказчик, поселение или слово из воспоминания…" /></label>
            {memoryPlaces.length > 0 && <details className="memory-filters">
              <summary><SlidersHorizontal size={17} /> Отбор по событиям карточек <span>{event !== "all" || yearRange ? "Фильтр применён" : "Все события и годы"}</span></summary>
              <Timeline
                places={memoryPlaces}
                event={event}
                onEventChange={next => { setEvent(next); setYearRange(null); }}
                value={yearRange}
                onChange={setYearRange}
                onReset={() => setYearRange(null)}
              />
              <p className="timeline-note">Шкала отбирает воспоминания по событиям связанных карточек. Период самого рассказа указан рядом с его заголовком.</p>
            </details>}
            {filteredMemories.length > 0 && <ResidentMemories
              title="Свидетельства из источников"
              memories={filteredMemories}
              placeTitles={placeTitles}
              onPlace={(id) => { const place = places.find((p) => p.id === id); if (place) openPlace(place); }}
            />}
            {filteredContributions.length > 0 && <section className="contributor-memories" aria-label="Воспоминания участников"><h2>Воспоминания участников</h2><div className="story-grid">{filteredContributions.map(p => <StoryCard key={p.id} place={p} saved={favorites.includes(p.id)} onFavorite={() => toggleFavorite(p.id)} onOpen={() => openPlace(p)}/>)}</div></section>}
            {!filteredMemories.length && !filteredContributions.length && <div className="empty"><h3>{memories.length || contributedMemories.length ? "Воспоминания не найдены" : "Воспоминания ещё не добавлены"}</h3><p>{memories.length || contributedMemories.length ? "Измените поиск или фильтры шкалы." : "В этом архиве пока нет опубликованных личных свидетельств."}</p></div>}
          </section>
        )}
        {page === "routes" && !loading && !loadError && (
          <section className="container routes-section">
            <div className="demo-notice">
              <Compass size={18} />
              <p>
                Цифровые маршруты объединяют истории по теме. Это подборки для
                чтения; они не задают путь для поездки. {hasCatalogue ? "Местоположения указаны приблизительно." : "Материалы этих подборок — демонстрационные примеры."}
              </p>
            </div>
            {routes.length === 0 && <div className="empty"><h3>Подборки пока не добавлены</h3><p>Здесь появятся тематические подборки опубликованных историй.</p></div>}
            <div className="story-grid route-grid">
              {routes.map((r, i) => (
                <button
                  className="route-card"
                  key={r.id}
                  onClick={() => openDialog({ type: "route", route: r })}
                >
                  <img
                    src={`/images/${r.image}.svg`}
                    alt="Иллюстрация к подборке"
                  />
                  <div className="route-card-body">
                    <span className="eyebrow">{r.subtitle}</span>
                    <h2>{r.title}</h2>
                    <div>
                      <span>
                        0{i + 1} / {r.places.length} {storyNoun(r.places.length)}
                      </span>
                      <ArrowUpRight size={23} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        {page === "about" && (
          <section className="container about-section">
            <div className="about-intro">
              <div><span className="eyebrow">ЗАДАЧИ ПРОЕКТА</span><h2>История поселений.<br />Источники и свидетельства.</h2></div>
              <div>
                <p>«Карта памяти Югры» — авторский научный проект {organization.shortName}. Проект собирает и систематизирует сведения о поселениях Югры, их истории и жизни жителей.</p>
                <p>В архиве представлены исторические паспорта, ссылки на публикации, фотографии и воспоминания. Для работы с материалом важно учитывать его источник, датировку и точность местоположения.</p>
              </div>
            </div>
            <div className="principles">
              <article>
                <span>01</span>
                <BookOpen size={26} />
                <h3>Источники и атрибуция</h3>
                <p>
                  У каждого материала есть автор и источник. Личное воспоминание
                  сохраняет свой статус и не подменяет подтверждённый
                  исторический факт.
                </p>
              </article>
              <article>
                <span>02</span>
                <Heart size={26} />
                <h3>Этика публикации</h3>
                <p>
                  Публикуем материалы с согласиями. Не раскрываем контактные
                  данные, закрытые знания и точные координаты чувствительных
                  мест.
                </p>
              </article>
              <article>
                <span>03</span>
                <Users size={26} />
                <h3>Редакторская проверка</h3>
                <p>
                  Историки, краеведы, музеи и жители могут дополнять карту.
                  Каждая история проходит проверку редактора перед публикацией.
                </p>
              </article>
            </div>
            <div className="about-policy">
              <h3>Участие в проекте</h3>
              <p>Вы можете передать воспоминание, фотографию или сведения о поселении. Укажите происхождение материала и известные даты. Перед публикацией материал поступает на редакторскую проверку.</p>
              <details className="project-invitation"><summary>Сохраним память о Севере вместе</summary>
              <p><strong>У каждого человека есть своя история. А вместе наши истории становятся памятью целого края.</strong></p>
              <p>Север — это не только бескрайние просторы, реки, леса и суровая природа. Прежде всего, это люди, их судьбы, воспоминания, традиции и места, которые навсегда остались в сердце.</p>
              <p>Когда-то здесь кипела жизнь, строились посёлки, рождались семьи, звучал детский смех, люди трудились, мечтали и создавали свою историю. Сегодня многие из этих мест исчезли с карт, но память о них продолжает жить в рассказах тех, кто был частью этой жизни.</p>
              <p><strong>Мы хотим сохранить эту память. И каждый из вас может стать частью нашего проекта.</strong></p>
              <p>Нажав кнопку <strong>«Добавить воспоминание»</strong>, вы можете поделиться своей историей, рассказать о родных местах, людях, событиях, загрузить старые фотографии или воспоминания, которые передавались в вашей семье из поколения в поколение.</p>
              <p>Ваш рассказ станет частью цифрового архива Севера — пространства, где сохраняются человеческие судьбы, история исчезнувших поселений и живые свидетельства прошлого.</p>
              <p>Неважно, насколько большой кажется ваша история. Иногда одна старая фотография, несколько строк или простое воспоминание способны рассказать о прошлом больше, чем десятки страниц исторических документов.</p>
              <p><strong>Благодаря вашим историям мы сможем увидеть Север таким, каким он был на самом деле.</strong> Не только через архивные документы и официальные даты, но и глазами людей, которые здесь жили, любили, трудились и оставили свой след.</p>
              <h3>История Севера складывается из наших воспоминаний.</h3>
              <p><strong>Поделитесь своей историей. Сохраним прошлое для будущих поколений.</strong></p>
              </details>
              <button className="button primary" onClick={() => openDialog({ type: "submit" })}><Plus size={17} />Добавить воспоминание</button>
              <details className="materials-terms">
                <summary>Условия публикации и обработки материалов</summary>
              <p>
                Имя, текст, место и источник публикуются после одобрения
                редактором. Email видит только редакция. Избранное хранится в
                вашем браузере. В первой версии нет рекламных трекеров и
                публичной регистрации пользователей.
              </p>
              <p>
                Организация, реализующая проект, и оператор материалов — {organization.shortName}.
                Контакт для обращений: <a href={`mailto:${organization.email}`}>{organization.email}</a>.
                Данные полного сервера хранятся с использованием Turso и Vercel Blob;
                эти сервисы могут обрабатывать данные за пределами России.
                Контакты и материалы сохраняются до ручного удаления редакцией;
                автоматический срок удаления сейчас не установлен.
              </p>
              </details>
            </div>
            <OrganizationDetails />
          </section>
        )}
        {page !== "favorites" && page !== "about" && (
          <section className="participate container">
            <div>
              <span className="eyebrow">ПОПОЛНЕНИЕ АРХИВА</span>
              <h2>Передать материал в проект</h2>
              <p>Воспоминания, фотографии и сведения о поселениях принимаются на редакторскую проверку.</p>
            </div>
            <button
              className="button light"
              onClick={() => openDialog({ type: "submit" })}
            >
              Добавить воспоминание <Plus size={18} />
            </button>
          </section>
        )}
      </main>
      <footer className="site-footer container">
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {organization.shortName}. Все права защищены.</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          wide={dialog.type === "submit" || dialog.type === "editor"}
          title={
            dialog.type === "place"
              ? dialog.place.title
              : dialog.type === "route"
                ? dialog.route.title
                : dialog.type === "submit"
                  ? "Добавить воспоминание"
                  : "Кабинет администратора"
          }
          onClose={closeDialog}
        >
          {window.history.state?.returnHash?.startsWith("#route/") && dialog.type === "place" && <button className="dialog-back text-button" onClick={closeDialog}>← Вернуться к подборке</button>}
          {window.history.state?.returnHash?.startsWith("#place/") && dialog.type === "submit" && <button className="dialog-back text-button" onClick={closeDialog}>← Вернуться к карточке</button>}
          {(dialog.type === "submit" || dialog.type === "editor") &&
            archiveMode !== "server" && (
            <div className="editor-login">
              <span className="eyebrow">КАРТА ПАМЯТИ ЮГРЫ</span>
              <h2>{loading ? "Открываем архив…" : archiveMode === "catalogue" ? "Архив открыт для чтения" : "Сервис временно недоступен"}</h2>
              <p>
                {archiveMode === "catalogue" ? "Паспорта, поиск и избранное доступны. Приём новых материалов и кабинет редактора пока недоступны на этом сайте." : "Не удалось подключиться к архиву. Закройте окно и повторите загрузку страницы позже."}
              </p>
              <button className="button primary" onClick={closeDialog}>
                Вернуться к архиву
              </button>
            </div>
          )}
          {dialog.type === "submit" && archiveMode === "server" && (
            <SubmissionForm key={dialog.relatedPlace?.id || "new-memory"} onClose={closeDialog} relatedPlace={dialog.relatedPlace} />
          )}
          {dialog.type === "editor" && archiveMode === "server" && (
            <Editor
              onAuthChange={setAdmin}
              onPublished={() => {
                void load();
              }}
            />
          )}
          {dialog.type === "place" && (
            <PlaceDetail
              key={dialog.place.id}
              canEdit={admin && archiveMode === "server"}
              onSaved={(saved) => { setPlaces(items => items.map(p => p.id === saved.id ? saved : p)); setDialog({type: "place", place: saved}); setToast("Изменения сохранены."); }}
              place={dialog.place}
              relatedPlace={places.find(p => p.id === dialog.place.relatedPlaceId)}
              additions={places.filter(p => p.relatedPlaceId === dialog.place.id)}
              onRelated={openPlace}
              saved={favorites.includes(dialog.place.id)}
              onFavorite={() => toggleFavorite(dialog.place.id)}
              onShare={() => setToast("Ссылка на историю скопирована.")}
              onContribute={() => openDialog({ type: "submit", relatedPlace: dialog.place })}
              onMap={() => showOnMap(dialog.place)}
            />
          )}
          {dialog.type === "route" && (
            <div className="route-detail">
              <img
                src={`/images/${dialog.route.image}.svg`}
                alt="Иллюстрация к подборке"
              />
              <div>
                <span className="eyebrow">{dialog.route.subtitle}</span>
                <h2>{dialog.route.title}</h2>
                <p>{dialog.route.description}</p>
                <ol>
                  {dialog.route.places.map((id) => {
                    const p = places.find((p) => p.id === id);
                    return (
                      p && (
                        <li key={id}>
                          <button onClick={() => openPlace(p)}>
                            <span>
                              <small>{p.location}</small>
                              <strong>{p.title}</strong>
                            </span>
                            <ArrowRight size={18} />
                          </button>
                        </li>
                      )
                    );
                  })}
                </ol>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
function Empty({
  reset,
  favorites = false,
  onExplore,
}: {
  reset: () => void;
  favorites?: boolean;
  onExplore?: () => void;
}) {
  return (
    <div className="empty">
      <Search size={30} />
      <h3>
        {favorites ? "Сохраните что-то дорогое" : "Пока нет таких историй"}
      </h3>
      <p>
        {favorites
          ? "Нажмите на сердечко у понравившегося места. Проверьте также выбранные фильтры."
          : "Попробуйте другое название, тему или время. Возможно, именно ваша история станет первой."}
      </p>
      <button className="text-button" onClick={reset}>
        Сбросить фильтры <ArrowRight size={15} />
      </button>
      {favorites && (
        <button className="button secondary" onClick={onExplore}>
          Открыть карту
        </button>
      )}
    </div>
  );
}
function StoryCard({
  place: p,
  saved,
  onFavorite,
  onOpen,
}: {
  place: Place;
  saved: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  return (
    <article className={`story-card ${p.mediaId ? "has-photograph" : "has-illustration"}`} data-accent={p.appearance?.accent}>
      <div className="story-image">
        <button onClick={onOpen} aria-label={`Открыть историю: ${p.title}`}>
          <img
            style={{objectPosition: p.appearance?.imagePosition || "center"}}
          src={imageFor(p)}
            alt={p.mediaId ? p.title : "Авторская иллюстрация"}
            loading="lazy"
          />
        </button>
        <span className="image-badge">
          {p.demo
            ? "ДЕМОНСТРАЦИЯ"
            : p.catalogue
              ? "ИСТОРИЯ ПОСЕЛЕНИЯ"
              : "ИСТОРИЯ ЖИТЕЛЯ"}
        </span>
        {!p.mediaId && <span className="catalogue-illustration-label">Иллюстрация</span>}
        <button
          className={`image-heart ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Убрать из избранного" : "В избранное"}: ${p.title}`}
          aria-pressed={saved}
          onClick={onFavorite}
        >
          <Heart size={17} />
        </button>
      </div>
      <div className="story-content">
        <div className="meta">
          {categoryLabel(p.category)} <span>· {dateFor(p)}</span>
        </div>
        <button className="story-title" onClick={onOpen}>
          <h3>{p.title}</h3>
        </button>
        <p>{p.summary}</p>
        {Boolean(p.memories?.length) && <button className="memoir-availability" onClick={onOpen}><BookOpen size={14} /> Воспоминания жителей · {p.memories!.length}</button>}
        <div className="story-bottom">
          <span>
            <MapPin size={13} />
            {p.location}
          </span>
          <button className="text-button" onClick={onOpen}>
            Читать историю <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function PlaceDetail({
  canEdit, onSaved,
  relatedPlace, additions, onRelated,
  place,
  saved,
  onFavorite,
  onShare,
  onContribute,
  onMap,
}: {
  canEdit: boolean;
  relatedPlace?: Place;
  additions: Place[];
  onRelated: (place: Place) => void;
  onSaved: (p: Place) => void;
  place: Place;
  saved: boolean;
  onFavorite: () => void;
  onShare: () => void;
  onContribute: () => void;
  onMap: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const p = publicPlaceContent(place);
  const [shareFallback, setShareFallback] = useState("");
  async function share() {
    const url = `${window.location.origin}/#place/${p.id}`;
    try {
      await navigator.clipboard.writeText(url);
      onShare();
    } catch {
      setShareFallback(url);
    }
  }
  if (editing && canEdit) return <EditPlace place={place} onSaved={p => {onSaved(p); setEditing(false);}} onCancel={() => setEditing(false)}/>;
  return (
    <article className="place-detail" data-accent={p.appearance?.accent}>
      {canEdit && <div className="admin-place-toolbar"><span>Режим администратора</span><button className="button secondary" onClick={() => setEditing(true)}><Pencil size={16}/>Изменить</button></div>}
      <div className="detail-image">
        <img
          style={{objectPosition: p.appearance?.imagePosition || "center"}}
          src={imageFor(p)}
          alt={
            p.mediaId
              ? p.title
              : "Авторская иллюстрация, не архивная фотография"
          }
        />
        <span className="image-badge">
          {p.mediaId ? "ЗАГРУЖЕННАЯ ФОТОГРАФИЯ" : "АВТОРСКАЯ ИЛЛЮСТРАЦИЯ"}
        </span>
      </div>
      <div className="detail-body">
        <span className="eyebrow">{categoryLabel(p.category)}</span>
        <h2>{p.title}</h2>
        {relatedPlace && <p className="related-place">Дополнение к карточке <button className="text-button" onClick={() => onRelated(relatedPlace)}>{relatedPlace.title} <ArrowRight size={14}/></button></p>}
        <div className="detail-meta">
          <span>
            <MapPin size={15} />
            {p.location}
          </span>
          <span>{dateFor(p)}</span>
        </div>
        <p className="location-certainty">{!hasCoordinates(p) ? "Координаты неизвестны. Это место пока не отмечено на карте." : p.coordinateStatus === "confirmed" ? "Местоположение отмечено редакцией как уточнённое. Основание — в паспорте." : "Приблизительное местоположение. Точная GPS-привязка не подтверждена; не используйте точку для навигации."}{p.historicalContext && ` ${p.historicalContext.coordinateScope}`}</p>
        {hasCoordinates(p) && (
          <div className="place-location-links">
            <button className="button secondary" onClick={onMap}><MapPin size={15} /> Показать на карте</button>
            <a href={yandexMapUrl([{ ...p, approximate: p.coordinateStatus !== "confirmed" }], { ...p, zoom: 13 }, false)} target="_blank" rel="noopener noreferrer">Яндекс Карты <ArrowUpRight size={14} /></a>
            <a href={googleMapUrl(p)} target="_blank" rel="noopener noreferrer">Google Maps <ArrowUpRight size={14} /></a>
          </div>
        )}
        {p.demo && (
          <div className="demo-notice">
            <Sparkles size={18} />
            <p>
              Демонстрационная карточка. Это пример наполнения архива; текст и
              изображение не являются архивными свидетельствами.
            </p>
          </div>
        )}
        <div className="prose">
          {p.story.split("\n\n").map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
        {p.historicalContext && <section className="historical-phases" aria-label="Исторические и современные поселения"><h3>Исторические и современные поселения</h3>{p.historicalContext.phases.map(phase => <article key={phase.title}><h4>{phase.title}</h4><strong>{phase.period}</strong><p>{phase.description}</p><a href={phase.sourceUrl} target="_blank" rel="noopener noreferrer">{phase.sourceTitle} <ArrowUpRight size={14}/></a></article>)}</section>}
        {(p.memories || []).length ? <ResidentMemories memories={p.memories || []} /> : additions.length === 0 ? <section className="resident-memories"><h3>Воспоминания жителей</h3><p>Воспоминания об этом поселении пока не добавлены.</p><button className="text-button" onClick={onContribute}>Поделиться воспоминанием <ArrowRight size={14}/></button></section> : null}
        {additions.length > 0 && <section className="related-stories"><h3>Истории участников об этом месте</h3>{additions.map(item => <button key={item.id} className="text-button" onClick={() => onRelated(item)}>{item.title} <ArrowRight size={14}/></button>)}</section>}
        {p.mediaId && <PhotoCredits credit={p.photoCredit}/>}
        <PassportCard passport={p.passport} />
        <BeforeAfter key={p.id} place={p} />
        <div className="source-box">
          <BookOpen size={19} />
          <div>
            <strong>Автор и источник</strong>
            <p>{p.author}</p>
            <p>{p.source}</p>
            <small>
              {p.latitude !== null && p.longitude !== null
                ? `${p.coordinateStatus === "confirmed" ? "Координаты" : "Примерное местоположение"}: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
                : "Местоположение не установлено"}{" "}
              · не для навигации
            </small>
          </div>
        </div>
        <div className="detail-actions">
          <button
            className={`button secondary ${saved ? "is-saved" : ""}`}
            onClick={onFavorite}
          >
            <Heart size={17} />
            {saved ? "В избранном" : "Сохранить место"}
          </button>
          <button className="button secondary" onClick={share}>
            <Share2 size={17} />
            Поделиться
          </button>
        </div>
        {shareFallback && (
          <label className="share-fallback">
            Скопируйте ссылку
            <input
              readOnly
              value={shareFallback}
              onFocus={(e) => e.target.select()}
            />
          </label>
        )}
        <div className="detail-contribute">
          <span>
            Помните это место иначе? У вас есть фотография или история?
          </span>
          <button className="text-button" onClick={onContribute}>
            Дополнить архив <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
