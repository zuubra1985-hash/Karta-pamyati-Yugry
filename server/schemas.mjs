import { z } from "zod";

const optionalText = z.string().trim().max(1000).optional();
export const passportSchema = z
  .object({
    documentTitle: z.string().trim().min(3).max(250),
    documentUrl: z
      .string()
      .url()
      .max(2000)
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Укажите HTTPS-ссылку без пароля.")
      .optional(),
    documentDate: z.string().trim().max(100).optional(),
    archiveReference: optionalText,
    officialName: z.string().trim().max(300).optional(),
    objectType: z.string().trim().max(200).optional(),
    period: z.string().trim().max(300).optional(),
    address: optionalText,
    condition: optionalText,
    protectionStatus: optionalText,
  })
  .strict();

export const photoCreditSchema = z.object({
  photographer: optionalText, date: optionalText, source: optionalText, rights: optionalText,
}).strict();

export const storyFields = {
  photoCredit: photoCreditSchema.optional(),
  afterPhotoCredit: photoCreditSchema.optional(),
  title: z.string().trim().min(5).max(150),
  location: z.string().trim().min(2).max(100),
  category: z.enum([
    "architecture",
    "settlements",
    "people",
    "culture",
    "nature",
  ]),
  year: z.number().int().min(1500).max(new Date().getFullYear()).nullable(),
  latitude: z.number().min(58).max(67).nullable(),
  longitude: z.number().min(58).max(86).nullable(),
  story: z.string().trim().min(80).max(15000),
  author: z.string().trim().min(2).max(100),
  source: z.string().trim().min(3).max(1000),
  afterYear: z
    .number()
    .int()
    .min(1500)
    .max(new Date().getFullYear())
    .optional(),
  afterSource: z.string().trim().min(3).max(1000).optional(),
  passport: passportSchema.nullable().optional(),
};
export const photoSchema = z.object({
  data: z.string().max(2800000),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
function validateCoordinatePair(value, ctx) {
  if ((value.latitude === null) !== (value.longitude === null))
    ctx.addIssue({code: "custom", path: ["latitude"], message: "Укажите обе координаты или оставьте местоположение неизвестным."});
}
export const submissionSchema = z
  .object({
    relatedPlaceId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    ...storyFields,
    contact: z.string().email().max(254),
    consent: z.literal(true),
    photo: photoSchema.optional(),
    afterPhoto: photoSchema.optional(),
  })
  .superRefine((value, ctx) => {
    validateCoordinatePair(value, ctx);
    if (
      value.afterPhoto &&
      (!value.photo || value.afterYear === undefined || !value.afterSource)
    )
      ctx.addIssue({
        code: "custom",
        path: ["afterPhoto"],
        message: "Для сравнения нужны два снимка, год и источник второго.",
      });
    if (
      !value.afterPhoto &&
      (value.afterYear !== undefined || value.afterSource !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        path: ["afterPhoto"],
        message: "Добавьте второй снимок или уберите его подпись.",
      });
  });
// Strict allowlist: media IDs, contacts, consents and publication state cannot be changed by this endpoint.
export const editorialSchema = z
  .object({ ...storyFields, revision: z.number().int().min(0) })
  .strict().superRefine(validateCoordinatePair);

export const placeEditSchema = z.object({
  ...storyFields,
  year: storyFields.year.nullable(),
  latitude: storyFields.latitude.nullable(),
  longitude: storyFields.longitude.nullable(),
  summary: z.string().trim().min(3).max(1000),
  dateLabel: z.string().trim().max(150),
  coordinateStatus: z.enum(["hypothesis", "unknown", "confirmed"]),
  passport: passportSchema.extend({
    economy: z.string().max(5000).optional(), population: z.string().max(5000).optional(),
    historicalStatus: optionalText, coordinateNote: optionalText,
    references: z.array(z.string().max(2000)).max(100).optional(),
    webSources: z.array(z.object({title: z.string().max(500), url: passportSchema.shape.documentUrl.unwrap(), publisher: z.string().max(500).optional()}).strict()).max(100).optional(),
  }).nullable(),
  appearance: z.object({accent: z.enum(["forest", "river", "clay"]), imagePosition: z.enum(["center", "top", "bottom"])}).strict(),
  photo: photoSchema.nullable().optional(),
  revision: z.number().int().min(0),
}).strict().superRefine((v, ctx) => {
  if ((v.latitude === null) !== (v.longitude === null) || (v.coordinateStatus === "unknown") !== (v.latitude === null))
    ctx.addIssue({code: "custom", message: "Укажите обе координаты и их достоверность либо выберите неизвестное местоположение."});
});
