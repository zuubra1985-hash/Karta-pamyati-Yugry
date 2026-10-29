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
import Editor from "./components/Editor";
import Timeline from "./components/Timeline";
import BeforeAfter from "./components/BeforeAfter";
import { PassportCard } from "./components/Passport";
import { loadArchive, type ArchiveMode } from "./archive";
import { publicPlaceContent } from "./content";
const MemoryMap = lazy(() => import("./components/MemoryMap"));
type Page = "map" | "stories" | "routes" | "about" | "favorites";
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
  | { type: "submit" | "editor" }
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
const nav: { id: Page; label: string }[] = [
  { id: "map", label: "Карта мест" },
  { id: "stories", label: "Истории" },
  { id: "routes", label: "Маршруты памяти" },
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
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [archiveMode, setArchiveMode] = useState<ArchiveMode | null>(null);
  const [page, setPage] = useState<Page>("map");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [decade, setDecade] = useState("all");
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
      if (hash.startsWith("place/")) {
        setPage("map");
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
              if (window.location.hash.slice(1) === hash)
                setToast("Эта история не найдена или пока не опубликована.");
            });
        } else if (!loading && archiveMode === "catalogue") {
          setToast("Этот паспорт не найден в опубликованном архиве.");
        }
      } else {
        setPage(
          (["map", "stories", "routes", "about", "favorites"].includes(hash)
            ? hash
            : "map") as Page,
        );
        setDialog((current) => (current?.type === "place" ? null : current));
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [places, loading, archiveMode]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const hasCatalogue = places.some((p) => p.catalogue);
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
        (!yearRange ||
          (p.year !== null &&
            p.year >= yearRange[0] &&
            p.year <= yearRange[1])) &&
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
    yearRange,
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
  function navigate(next: Page) {
    window.location.hash = next;
    setPage(next);
    setDialog(null);
    setMenu(false);
    setSearch("");
    setCategory("all");
    setDecade("all");
    setYearRange(null);
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
  function openPlace(place: Place) {
    setSelected(place.id);
    setDialog({ type: "place", place });
    window.history.replaceState(null, "", `#place/${place.id}`);
  }
  function closeDialog() {
    setDialog(null);
    if (window.location.hash.startsWith("#place/"))
      window.history.replaceState(null, "", `#${page}`);
  }
  function resetFilters() {
    setSearch("");
    setCategory("all");
    setDecade("all");
    setYearRange(null);
    setOnlyReal(false);
  }
  function explore() {
    document
      .getElementById("explore")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const routes: Route[] = hasCatalogue
    ? [
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
            "Паспорта поселений, связанных с историей спецпереселения. Координаты — гипотезы, не навигационные точки.",
        },
        {
          id: "names",
          title: "Старые имена на карте Югры",
          subtitle: "ТОПОНИМЫ И ПРЕЕМСТВЕННОСТЬ",
          image: "forest",
          places: ["pas-003", "pas-005", "pas-009", "pas-024", "pas-033"],
          description:
            "Имена старых деревень и исторических городских территорий. В карточках сохранены сведения исправленного свода. Подборка не задаёт путь посещения объектов.",
        },
      ]
    : demoRoutes;
  const isArchive = ["map", "stories", "favorites"].includes(page);
  return (
    <>
      <a className="skip-link" href="#main">
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
              onClick={() => setDialog({ type: "submit" })}
            >
              <Plus size={17} />
              Добавить историю
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
      <main id="main">
        {page === "map" && (
          <section className="hero container">
            <div className="hero-text">
              <div className="eyebrow">
                <span className="eyebrow-line" /> ЖИВОЙ АРХИВ РОДНОГО КРАЯ
              </div>
              <h1>
                У каждого места
                <br />
                есть своя <em>память.</em>
              </h1>
              <p>
                Истории людей, знакомые улицы и исчезнувшие посёлки.
                <br className="desktop-break" /> Сохраняем то, что связывает нас
                с Югрой.
              </p>
              <div className="hero-actions">
                <button className="button primary" onClick={explore}>
                  Открыть карту <ArrowUpRight size={18} />
                </button>
                <button
                  className="text-button"
                  onClick={() => navigate("about")}
                >
                  Как устроен проект <ArrowRight size={16} />
                </button>
              </div>
              <div className="hero-facts">
                <div>
                  <strong>
                    {loading ? "…" : loadError ? "—" : places.length.toString().padStart(2, "0")}
                  </strong>
                  <span>мест с историями</span>
                </div>
                <i />
                <div>
                  <strong>05</strong>
                  <span>тем для открытия</span>
                </div>
                <i />
                <div className="fact-human">
                  <Users size={23} />
                  <span>
                    Сохраняем
                    <br />
                    вместе с вами
                  </span>
                </div>
              </div>
            </div>
            <div className="hero-art">
              <img
                src="/images/hero.svg"
                alt="Иллюстрация: извилистая северная река среди хвойных лесов"
              />
              <div className="hero-coordinate">
                61°15′ с. ш. &nbsp; 73°24′ в. д.
                <span>Там, где начинается наша история</span>
              </div>
              <div className="hero-stamp">
                <Compass size={31} strokeWidth={1} />
                <span>
                  МЕСТА. ЛЮДИ.
                  <br />
                  ВОСПОМИНАНИЯ.
                </span>
              </div>
              <span className="art-credit">АВТОРСКАЯ ИЛЛЮСТРАЦИЯ</span>
            </div>
          </section>
        )}
        {page !== "map" && (
          <section className="page-heading container">
            <span className="eyebrow">КАРТА ПАМЯТИ ЮГРЫ</span>
            <h1>
              {page === "stories"
                ? "Истории, которые рядом."
                : page === "favorites"
                  ? "Места, которые дороги."
                  : page === "routes"
                    ? "У каждой дороги — история."
                    : "Сохраним память. Вместе."}
            </h1>
            <p>
              {page === "stories"
                ? "Небольшие рассказы складываются в большую историю нашего края."
                : page === "favorites"
                  ? "Ваш личный список мест. Сохраняется в этом браузере на этом устройстве."
                  : page === "routes"
                    ? "Тематические путешествия по живому архиву Югры."
                    : "Живой архив мест, людей и воспоминаний о Югре."}
            </p>
          </section>
        )}
        {isArchive && (
          <section id="explore" className="archive container">
            <div className="section-top">
              <div>
                <span className="eyebrow">
                  {page === "favorites"
                    ? "ВАША КОЛЛЕКЦИЯ"
                    : "БОЛЬШАЯ ИСТОРИЯ В МАЛЕНЬКИХ ДЕТАЛЯХ"}
                </span>
                <h2>
                  {page === "map"
                    ? "Найдите своё место в истории"
                    : page === "favorites"
                      ? "Избранные места"
                      : "Листая память Югры"}
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
            <Timeline
              places={places}
              value={
                yearRange ||
                (decade !== "all" ? [Number(decade), Number(decade) + 9] : null)
              }
              onChange={(range) => {
                setDecade("all");
                setYearRange(range);
              }}
              onReset={() => {
                setDecade("all");
                setYearRange(null);
              }}
            />
            {!loading && !loadError && <div className="demo-notice">
              <span className="demo-dot" />
              <p>
                {hasCatalogue ? (
                  <>
                    <strong>
                      {places.filter((p) => p.catalogue).length} историй
                      поселений Югры.
                    </strong>{" "}
                    Приблизительные местоположения включаются на карте отдельно.
                    Изображения — иллюстрации.
                  </>
                ) : (
                  <>
                    <strong>Первая глава нашего архива.</strong> Стартовые
                    карточки — демонстрационные примеры, изображения —
                    иллюстрации.
                  </>
                )}
              </p>
              <button onClick={() => setDialog({ type: "submit" })}>
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
                  onClick={() => setDialog({ type: "submit" })}
                >
                  Расскажите о нём <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        {page === "map" && (
          <section className="featured container">
            <div className="section-top">
              <div>
                <span className="eyebrow">НЕ ТОЛЬКО ТОЧКИ НА КАРТЕ</span>
                <h2>За каждым местом — люди</h2>
              </div>
              <button
                className="text-button"
                onClick={() => navigate("stories")}
              >
                Все истории <ArrowRight size={17} />
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
        {page === "routes" && (
          <section className="container routes-section">
            <div className="demo-notice">
              <Compass size={18} />
              <p>
                Цифровые маршруты объединяют истории по теме. Это подборки для
                чтения, а не навигационные треки. Стартовые материалы
                демонстрационные.
              </p>
            </div>
            <div className="story-grid route-grid">
              {routes.map((r, i) => (
                <button
                  className="route-card"
                  key={r.id}
                  onClick={() => setDialog({ type: "route", route: r })}
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
                        0{i + 1} / {r.places.length} истории
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
              <div>
                <span className="eyebrow">ОТ ЛИЧНОГО — К ОБЩЕМУ</span>
                <h2>
                  История края живёт
                  <br />в наших воспоминаниях.
                </h2>
              </div>
              <div>
                <p>
                  «Карта памяти Югры» — место, где семейная фотография, рассказ
                  о знакомой улице или воспоминание о посёлке становятся частью
                  общего архива.
                </p>
                <p>
                  Мы хотим сохранить не только даты и названия, но и
                  человеческий взгляд: как выглядел двор, куда ходили в школу и
                  какие места особенно дороги.
                </p>
              </div>
            </div>
            <img
              className="about-panorama"
              src="/images/hero.svg"
              alt="Авторская иллюстрация северной реки"
            />
            <div className="principles">
              <article>
                <span>01</span>
                <BookOpen size={26} />
                <h3>Источники имеют значение</h3>
                <p>
                  У каждого материала есть автор и источник. Личное воспоминание
                  сохраняет свой статус и не подменяет подтверждённый
                  исторический факт.
                </p>
              </article>
              <article>
                <span>02</span>
                <Heart size={26} />
                <h3>Бережно к людям</h3>
                <p>
                  Публикуем материалы с согласиями. Не раскрываем контактные
                  данные, закрытые знания и точные координаты чувствительных
                  мест.
                </p>
              </article>
              <article>
                <span>03</span>
                <Users size={26} />
                <h3>Архив открыт для участия</h3>
                <p>
                  Историки, краеведы, музеи и жители могут дополнять карту.
                  Каждая история проходит проверку редактора перед публикацией.
                </p>
              </article>
            </div>
            <div className="about-policy">
              <h3>Как используются ваши материалы</h3>
              <p>
                Имя, текст, место и источник публикуются после одобрения
                редактором. Email видит только редакция. Избранное хранится в
                вашем браузере. В первой версии нет рекламных трекеров и
                публичной регистрации пользователей.
              </p>
              <p>
                Для запуска публичного проекта владельцу необходимо указать
                контакты редакции, порядок исправления и удаления материалов,
                сведения об операторе и условия обработки персональных данных.
                Эти реквизиты пока не предоставлены.
              </p>
            </div>
          </section>
        )}
        {page !== "favorites" && (
          <section className="participate container">
            <div className="participate-symbol">
              <Mark small />
              <span className="symbol-orbit" />
            </div>
            <div>
              <span className="eyebrow">
                ПАМЯТЬ СТАНОВИТСЯ ОБЩЕЙ, КОГДА ЕЮ ДЕЛЯТСЯ
              </span>
              <h2>Ваша история — часть Югры.</h2>
              <p>
                Старый снимок. Знакомый дом. Рассказ близкого человека.
                <br />
                Помогите сохранить то, что нельзя потерять.
              </p>
            </div>
            <button
              className="button light"
              onClick={() => setDialog({ type: "submit" })}
            >
              Добавить воспоминание <Plus size={18} />
            </button>
          </section>
        )}
      </main>
      <footer className="site-footer container">
        <div className="footer-top">
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
          <p>
            Места, которые помним.
            <br />
            Истории, которые сохраним.
          </p>
          <div>
            <button onClick={() => navigate("about")}>О проекте</button>
            <button onClick={() => setDialog({ type: "editor" })}>
              Редакция <ArrowUpRight size={13} />
            </button>
          </div>
          <span className="footer-region">
            <MapPin size={15} /> Сделано для Югры
            <br />
            <small>С вниманием к прошлому</small>
          </span>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Карта памяти Югры</span>
          <span>
            {archiveMode === "catalogue"
              ? "Открытый каталог паспортов"
              : "Первая версия · открыты для ваших историй"}
          </span>
          <span>Помнить — значит сохранять.</span>
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
                  : "Кабинет редактора"
          }
          onClose={closeDialog}
        >
          {(dialog.type === "submit" || dialog.type === "editor") &&
            archiveMode !== "server" && (
            <div className="editor-login">
              <span className="eyebrow">КАРТА ПАМЯТИ ЮГРЫ</span>
              <h2>{loading ? "Открываем архив…" : "Архив открыт для чтения"}</h2>
              <p>
                Паспорта, поиск и избранное доступны. Приём новых материалов и
                кабинет редактора пока недоступны на этом сайте.
              </p>
              <button className="button primary" onClick={closeDialog}>
                Вернуться к архиву
              </button>
            </div>
          )}
          {dialog.type === "submit" && archiveMode === "server" && (
            <SubmissionForm onClose={closeDialog} />
          )}
          {dialog.type === "editor" && archiveMode === "server" && (
            <Editor
              onPublished={() => {
                void load();
              }}
            />
          )}
          {dialog.type === "place" && (
            <PlaceDetail
              place={dialog.place}
              saved={favorites.includes(dialog.place.id)}
              onFavorite={() => toggleFavorite(dialog.place.id)}
              onShare={() => setToast("Ссылка на историю скопирована.")}
              onContribute={() => setDialog({ type: "submit" })}
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
    <article className="story-card">
      <div className="story-image">
        <button onClick={onOpen} aria-label={`Открыть историю: ${p.title}`}>
          <img
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
  place,
  saved,
  onFavorite,
  onShare,
  onContribute,
}: {
  place: Place;
  saved: boolean;
  onFavorite: () => void;
  onShare: () => void;
  onContribute: () => void;
}) {
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
  return (
    <article className="place-detail">
      <div className="detail-image">
        <img
          src={imageFor(p)}
          alt={
            p.mediaId
              ? p.title
              : "Авторская иллюстрация, не архивная фотография"
          }
        />
        <span className="image-badge">
          {p.mediaId ? "ФОТОГРАФИЯ УЧАСТНИКА" : "АВТОРСКАЯ ИЛЛЮСТРАЦИЯ"}
        </span>
      </div>
      <div className="detail-body">
        <span className="eyebrow">{categoryLabel(p.category)}</span>
        <h2>{p.title}</h2>
        <div className="detail-meta">
          <span>
            <MapPin size={15} />
            {p.location}
          </span>
          <span>{dateFor(p)}</span>
        </div>
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
                ? `Координатная гипотеза: ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`
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
