import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

const submissionSchema = z.object({
  title: z.string().trim().min(5).max(150),
  location: z.string().trim().min(2).max(100),
  category: z.enum([
    "architecture",
    "settlements",
    "people",
    "culture",
    "nature",
  ]),
  year: z.number().int().min(1500).max(new Date().getFullYear()),
  latitude: z.number().min(58).max(67),
  longitude: z.number().min(58).max(86),
  story: z.string().trim().min(80).max(15000),
  author: z.string().trim().min(2).max(100),
  contact: z.string().email().max(254),
  source: z.string().trim().min(3).max(1000),
  consent: z.literal(true),
  photo: z
    .object({
      data: z.string().max(2800000),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
});
function decodePhoto(photo) {
  if (!photo) return null;
  const bytes = Buffer.from(photo.data, "base64");
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 12)
    throw new Error("Изображение должно быть не больше 2 МБ.");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (
    !(
      (photo.type === "image/png" && png) ||
      (photo.type === "image/jpeg" && jpeg) ||
      (photo.type === "image/webp" && webp)
    )
  )
    throw new Error("Допустимы только изображения JPEG, PNG и WebP.");
  return { bytes, type: photo.type };
}
export function createApp(store, { production = false, origin } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://*.tile.openstreetmap.org",
              ],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: null,
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const requestOrigin = req.get("origin");
      const expected = origin || `${req.protocol}://${req.get("host")}`;
      if (
        (requestOrigin && requestOrigin !== expected) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res
          .status(403)
          .json({ error: "Запрос с другого сайта запрещён." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Ожидается JSON." });
    }
    next();
  });
  const token = (req) => {
    const match = req.headers.cookie?.match(
      /(?:^|;\s*)memory_session=([a-f0-9]{64})(?:;|$)/,
    );
    return match?.[1];
  };
  const requireAdmin = (req, res, next) => {
    const session = store.session(token(req));
    if (!session)
      return res.status(401).json({ error: "Войдите в кабинет редактора." });
    req.admin = session;
    next();
  };
  const limiter = (max) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: max,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Слишком много запросов. Попробуйте через 15 минут." },
    });
  app.get("/api/health", (_, res) => res.json({ status: "ok" }));
  app.get("/api/places", (_, res) => res.json(store.places()));
  app.get("/api/places/:id", (req, res) => {
    const place = store.place(req.params.id);
    return place
      ? res.json(place)
      : res.status(404).json({ error: "Место не найдено." });
  });
  app.post("/api/submissions", limiter(10), (req, res) => {
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error:
            "Проверьте поля: рассказ от 80 символов, год от 1500 до текущего, координаты в пределах Югры и согласие на публикацию.",
          fields: parsed.error.issues.map((i) => i.path.join(".")),
        });
    const { photo, ...data } = parsed.data;
    let image;
    try {
      image = decodePhoto(photo);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const id = store.submit(data, image);
    res.status(201).json({ id, status: "pending" });
  });
  app.get("/api/media/:id", (req, res) => {
    const media = store.media(
      req.params.id,
      Boolean(store.session(token(req))),
    );
    if (!media) return res.sendStatus(404);
    res.type(media.type).send(Buffer.from(media.bytes));
  });
  app.post("/api/admin/login", limiter(10), (req, res) => {
    const parsed = z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(1).max(256),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Укажите email и пароль." });
    const sessionToken = store.login(parsed.data.email, parsed.data.password);
    if (!sessionToken)
      return res.status(401).json({ error: "Неверный email или пароль." });
    res
      .cookie("memory_session", sessionToken, {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        maxAge: 8 * 60 * 60 * 1000,
        path: "/",
      })
      .json({ email: parsed.data.email });
  });
  app.get("/api/admin/session", requireAdmin, (req, res) =>
    res.json(req.admin),
  );
  app.post("/api/admin/logout", requireAdmin, (req, res) => {
    store.logout(token(req));
    res
      .clearCookie("memory_session", {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        path: "/",
      })
      .json({ ok: true });
  });
  app.get("/api/admin/submissions", requireAdmin, (_, res) =>
    res.json(store.submissions()),
  );
  app.post("/api/admin/submissions/:id", requireAdmin, (req, res) => {
    const parsed = z
      .object({
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(1000).default(""),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Некорректное решение." });
    if (!store.moderate(req.params.id, parsed.data.action, parsed.data.reason))
      return res
        .status(409)
        .json({ error: "Материал уже рассмотрен или не найден." });
    res.json({ ok: true });
  });
  app.use("/api", (_, res) =>
    res.status(404).json({ error: "Такого API нет." }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large")
      return res
        .status(413)
        .json({ error: "Файл слишком большой. Максимум 2 МБ." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Некорректный JSON." });
    console.error("Request failed:", error.message);
    res
      .status(500)
      .json({ error: "Не удалось выполнить запрос. Попробуйте позже." });
  });
  return app;
}
