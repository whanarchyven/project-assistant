import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),

  // Проекты пользователей
  projects: defineTable({
    name: v.string(),
    userId: v.id("users"),
    pdfFileId: v.id("_storage"),
    ceilingHeight: v.optional(v.number()), // высота потолков в метрах
    scale: v.optional(v.object({
      knownLength: v.number(), // известная длина в метрах
      pixelLength: v.number(), // длина в пикселях на экране
    })),
  }).index("by_user", ["userId"]),

  // Страницы PDF в проекте
  pages: defineTable({
    projectId: v.id("projects"),
    pageNumber: v.number(),
    pdfFileId: v.id("_storage"),
  }).index("by_project", ["projectId"]),

  // Этапы сметы для каждой страницы
  stages: defineTable({
    pageId: v.id("pages"),
    stageType: v.union(
      v.literal("measurement"), // Обмер
      v.literal("installation"), // Монтаж
      v.literal("demolition"), // Демонтаж
      v.literal("electrical"), // Электрика
      v.literal("plumbing"), // Сантехника
      v.literal("finishing"), // Отделка
      v.literal("materials") // Материалы
    ),
    data: v.any(), // данные этапа (будет специфично для каждого типа)
    isCompleted: v.boolean(),
  }).index("by_page", ["pageId"]),

  // Измерения и разметки
  measurements: defineTable({
    stageId: v.id("stages"),
    type: v.union(
      v.literal("wall"), // стена
      v.literal("area"), // площадь
      v.literal("perimeter"), // периметр
      v.literal("point"), // точка
      v.literal("line") // линия
    ),
    coordinates: v.array(v.object({
      x: v.number(),
      y: v.number(),
    })),
    properties: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
  }).index("by_stage", ["stageId"]),

  // SVG элементы для рисования на чертежах
  svgElements: defineTable({
    pageId: v.id("pages"),
    stageType: v.union(
      v.literal("measurement"), // Обмер
      v.literal("installation"), // Монтаж
      v.literal("demolition"), // Демонтаж
      v.literal("electrical"), // Электрика
      v.literal("plumbing"), // Сантехника
      v.literal("finishing"), // Отделка
      v.literal("materials") // Материалы
    ),
    elementType: v.union(
      v.literal("line"),
      v.literal("rectangle"),
      v.literal("circle"),
      v.literal("text"),
      v.literal("polygon")
    ),
    data: v.any(), // данные элемента (координаты, размеры и т.д.)
    style: v.object({
      stroke: v.string(),
      strokeWidth: v.number(),
      fill: v.string(),
      opacity: v.number(),
    }),
    order: v.number(), // порядок отображения элементов
  }).index("by_page_and_stage", ["pageId", "stageType"]),
});
