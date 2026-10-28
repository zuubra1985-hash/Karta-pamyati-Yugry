import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  LogOut,
  X,
  Inbox,
  RefreshCw,
  Pencil,
  History,
} from "lucide-react";
import { api, categoryLabel, type Submission, type EditRecord } from "../types";
import EditSubmission from "./EditSubmission";
import BeforeAfter from "./BeforeAfter";
import { PassportCard } from "./Passport";
export default function Editor({ onPublished }: { onPublished: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Submission[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [edits, setEdits] = useState<EditRecord[]>([]);
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  async function load() {
    try {
      setItems(await api<Submission[]>("/api/admin/submissions"));
      setEditing(null);
      setHistoryFor(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    api<{ email: string }>("/api/admin/session")
      .then((data) => {
        setEmail(data.email);
        void load();
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ email: string }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      setEmail(data.email);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function decide(id: string, action: "approve" | "reject") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/submissions/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: reasons[id] || "",
          revision: items.find((item) => item.id === id)?.revision,
        }),
      });
      await load();
      if (action === "approve") onPublished();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <div className="loading">Открываем редакцию…</div>;
  if (!email)
    return (
      <div className="editor-login">
        <span className="eyebrow">БЕРЕЖНО СОХРАНЯЕМ ИСТОРИИ</span>
        <h2>Кабинет редактора</h2>
        <p>
          Проверка материалов, источников и согласий перед публикацией на карте.
        </p>
        <form onSubmit={login}>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Пароль
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Проверяем…" : "Войти в редакцию"}
          </button>
        </form>
        <p className="muted small">
          Учётную запись создаёт владелец проекта. Публичной регистрации
          редакторов нет.
        </p>
      </div>
    );
  const visible = items.filter((i) =>
    history ? i.status !== "pending" : i.status === "pending",
  );
  return (
    <div className="editor">
      <div className="section-top">
        <div>
          <span className="eyebrow">РЕДАКЦИЯ</span>
          <h2>Истории на проверке</h2>
          <p className="muted small">{email}</p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await api("/api/admin/logout", { method: "POST", body: "{}" });
              setEmail(null);
              setItems([]);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <LogOut size={15} /> Выйти
        </button>
      </div>
      <div className="editor-tabs">
        <button
          className={!history ? "active" : ""}
          onClick={() => setHistory(false)}
        >
          Ожидают проверки ·{" "}
          {items.filter((i) => i.status === "pending").length}
        </button>
        <button
          className={history ? "active" : ""}
          onClick={() => setHistory(true)}
        >
          Рассмотренные
        </button>
        <button aria-label="Обновить материалы" onClick={load}>
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="editor-notice" role="status">
          {notice}
        </div>
      )}
      {!visible.length && (
        <div className="empty">
          <Inbox size={35} />
          <h3>Пока здесь тихо</h3>
          <p>
            {history
              ? "Рассмотренных материалов ещё нет."
              : "Новые истории появятся здесь после отправки."}
          </p>
        </div>
      )}
      {visible.map((item) => (
        <article key={item.id} className="review-card">
          <div className="meta">
            {categoryLabel(item.category)} · {item.location} · {item.year}
          </div>
          <h3>{item.title}</h3>
          <div className="editor-card-tools">
            {item.status === "pending" && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(editing === item.id ? null : item.id);
                  setNotice("");
                  setError("");
                }}
              >
                <Pencil size={14} />
                {editing === item.id ? "Закрыть правку" : "Уточнить материал"}
              </button>
            )}
            <button
              className="text-button"
              onClick={async () => {
                if (historyFor === item.id) {
                  setHistoryFor(null);
                  return;
                }
                setError("");
                try {
                  setEdits(
                    await api<EditRecord[]>(
                      `/api/admin/submissions/${item.id}/history`,
                    ),
                  );
                  setHistoryFor(item.id);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <History size={14} />
              История правок
            </button>
          </div>
          {historyFor === item.id && (
            <div className="edit-history">
              {edits.length ? (
                edits.map((edit) => (
                  <details key={edit.revision}>
                    <summary>
                      Правка {edit.revision} ·{" "}
                      {new Date(edit.createdAt).toLocaleString("ru-RU")} ·{" "}
                      {edit.editor}
                    </summary>
                    <div className="edit-history-versions">
                      <div>
                        <strong>До правки</strong>
                        <p>{edit.before.title}</p>
                        <p>
                          {edit.before.year} · {edit.before.location}
                        </p>
                        <p>{edit.before.story}</p>
                        <p>Источник: {edit.before.source}</p>
                        <PassportCard passport={edit.before.passport} />
                      </div>
                      <div>
                        <strong>После правки</strong>
                        <p>{edit.after.title}</p>
                        <p>
                          {edit.after.year} · {edit.after.location}
                        </p>
                        <p>{edit.after.story}</p>
                        <p>Источник: {edit.after.source}</p>
                        <PassportCard passport={edit.after.passport} />
                      </div>
                    </div>
                  </details>
                ))
              ) : (
                <p>Редакторских правок ещё нет. Исходный материал сохранён.</p>
              )}
            </div>
          )}
          {editing === item.id ? (
            <EditSubmission
              key={`${item.id}-${item.revision}`}
              item={item}
              onCancel={() => setEditing(null)}
              onSaved={(updated) => {
                setItems((current) =>
                  current.map((record) =>
                    record.id === updated.id ? updated : record,
                  ),
                );
                setEditing(null);
                setHistoryFor(null);
                setNotice(
                  "Уточнения сохранены. Проверьте карточку, затем опубликуйте материал.",
                );
              }}
            />
          ) : (
            <>
              {item.mediaId && (
                <img
                  className="review-image"
                  alt="Фотография из материала"
                  src={`/api/media/${item.mediaId}`}
                />
              )}
              <PassportCard passport={item.passport} />
              {item.afterMediaId && (
                <BeforeAfter place={{ ...item, image: "river", demo: false }} />
              )}
              <div className="prose">
                {item.story.split("\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <dl>
                <dt>Автор</dt>
                <dd>{item.author}</dd>
                <dt>Email, не публикуется</dt>
                <dd>{item.contact}</dd>
                <dt>Источник</dt>
                <dd>{item.source}</dd>
                <dt>Координаты</dt>
                <dd>
                  {item.latitude}, {item.longitude}
                </dd>
              </dl>
              {item.status === "pending" ? (
                <>
                  <label>
                    Примечание редактора
                    <input
                      maxLength={1000}
                      value={reasons[item.id] || ""}
                      onChange={(e) =>
                        setReasons((r) => ({ ...r, [item.id]: e.target.value }))
                      }
                      placeholder="Например, требуется разрешение автора снимка"
                    />
                  </label>
                  <div className="review-actions">
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() => decide(item.id, "reject")}
                    >
                      <X size={16} />
                      Отклонить
                    </button>
                    <button
                      disabled={busy}
                      className="button primary"
                      onClick={() => decide(item.id, "approve")}
                    >
                      <Check size={16} />
                      Опубликовать
                    </button>
                  </div>
                </>
              ) : (
                <div className="review-status">
                  {item.status === "approved" ? "Опубликовано" : "Отклонено"}
                  {item.reason && ` · ${item.reason}`}
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
