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
      v.literal("markup"), // Разметка (комнаты/окна/двери)
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
      v.literal("markup"), // Разметка
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
    semanticType: v.optional(v.union(
      v.literal("room"),
      v.literal("door"),
      v.literal("window")
    )),
    data: v.any(), // данные элемента (координаты, размеры и т.д.)
    style: v.object({
      stroke: v.string(),
      strokeWidth: v.number(),
      fill: v.string(),
      opacity: v.number(),
    }),
    order: v.number(), // порядок отображения элементов
  }).index("by_page_and_stage", ["pageId", "stageType"]),

  // Дефолтные материалы пользователя/команды
  materialsDefaults: defineTable({
    ownerUserId: v.id("users"),
    stageType: v.union(
      v.literal("measurement"),
      v.literal("installation"),
      v.literal("demolition"),
      v.literal("markup"),
      v.literal("electrical"),
      v.literal("plumbing"),
      v.literal("finishing"),
      v.literal("materials")
    ),
    name: v.string(),
    consumptionPerUnit: v.number(), // расход на единицу триггера этапа (например, м стены)
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()), // ед. измерения, опционально
    triggerType: v.optional(v.union(
      v.literal("room"),
      v.literal("door"),
      v.literal("window")
    )),
  }).index("by_owner_and_stage", ["ownerUserId", "stageType"]),

  // Материалы проекта (копия/переопределение дефолтов)
  projectMaterials: defineTable({
    projectId: v.id("projects"),
    stageType: v.union(
      v.literal("measurement"),
      v.literal("installation"),
      v.literal("demolition"),
      v.literal("markup"),
      v.literal("electrical"),
      v.literal("plumbing"),
      v.literal("finishing"),
      v.literal("materials")
    ),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    triggerType: v.optional(v.union(
      v.literal("room"),
      v.literal("door"),
      v.literal("window")
    )),
  }).index("by_project_and_stage", ["projectId", "stageType"]),

  // Типы комнат пользователя
  roomTypes: defineTable({
    ownerUserId: v.id("users"),
    name: v.string(),
  }).index("by_owner", ["ownerUserId"]),

  // Материалы для конкретного типа комнаты (в библиотеке типов комнат)
  roomTypeMaterials: defineTable({
    ownerUserId: v.id("users"),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.union(v.literal('floor_m2'), v.literal('wall_m2')), // от чего считается расход
  }).index("by_owner_and_room_type", ["ownerUserId", "roomTypeId"]),

  // Комнаты проекта, сопоставление с элементом svg (polygon)
  rooms: defineTable({
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    elementId: v.id("svgElements"),
    name: v.string(),
    roomTypeId: v.id("roomTypes"),
  })
    .index("by_project_and_page", ["projectId", "pageId"]) 
    .index("by_page", ["pageId"]),

  // Материалы для предустановленных типов проёмов (door/window/opening)
  openingMaterials: defineTable({
    ownerUserId: v.id("users"),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    // основа расчёта: по площади проёма (м²) или фиксировано "на 1 проём"
    basis: v.union(v.literal('opening_m2'), v.literal('per_opening')),
  }).index("by_owner_and_type", ["ownerUserId", "openingType"]),

  // Проёмы/двери/окна на стенах комнат
  openings: defineTable({
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    elementId: v.id("svgElements"), // линия на схеме
    roomId1: v.id("rooms"),
    roomId2: v.optional(v.id("rooms")),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    heightMm: v.number(),
    lengthPx: v.number(),
  }).index("by_project", ["projectId"]).index("by_page", ["pageId"]),
});
