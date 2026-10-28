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

export const storyFields = {
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
const photoSchema = z.object({
  data: z.string().max(2800000),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export const submissionSchema = z
  .object({
    ...storyFields,
    contact: z.string().email().max(254),
    consent: z.literal(true),
    photo: photoSchema.optional(),
    afterPhoto: photoSchema.optional(),
  })
  .superRefine((value, ctx) => {
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
    if (value.afterYear !== undefined && value.afterYear < value.year)
      ctx.addIssue({
        code: "custom",
        path: ["afterYear"],
        message: "Второй снимок не может быть раньше первого.",
      });
  });
// Strict allowlist: media IDs, contacts, consents and publication state cannot be changed by this endpoint.
export const editorialSchema = z
  .object({ ...storyFields, revision: z.number().int().min(0) })
  .strict();
