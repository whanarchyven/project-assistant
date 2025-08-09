import { v } from "convex/values";
import { query, mutation, action, internalAction, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Генерация URL для загрузки PDF
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Создание нового проекта
export const createProject = mutation({
  args: {
    name: v.string(),
    pdfFileId: v.id("_storage"),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      userId,
      pdfFileId: args.pdfFileId,
    });

    // Создаем страницы для PDF
    await ctx.scheduler.runAfter(0, internal.projects.createPagesFromPdf, {
      projectId,
      pdfFileId: args.pdfFileId,
    });

    // Скопировать дефолтные материалы пользователя в материалы проекта
    await ctx.scheduler.runAfter(0, internal.projects.copyDefaultMaterialsToProject, {
      projectId,
    });

    return projectId;
  },
});

// Удаление проекта вместе со страницами и элементами
export const deleteProject = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) throw new Error("Проект не найден");

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const page of pages) {
      const elements = await ctx.db
        .query("svgElements")
        .withIndex("by_page_and_stage", (q) => q.eq("pageId", page._id))
        .collect();
      for (const el of elements) {
        await ctx.db.delete(el._id);
      }
      await ctx.db.delete(page._id);
    }

    // Материалы проекта
    const materials = await ctx.db
      .query("projectMaterials")
      .withIndex("by_project_and_stage", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const m of materials) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(args.projectId);
    return null;
  },
});

// Получение списка проектов пользователя
export const getUserProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      pdfFileId: v.id("_storage"),
      ceilingHeight: v.optional(v.number()),
      scale: v.optional(v.object({
        knownLength: v.number(),
        pixelLength: v.number(),
      })),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Убираем userId из возвращаемых данных
    return projects.map(project => ({
      _id: project._id,
      _creationTime: project._creationTime,
      name: project.name,
      pdfFileId: project.pdfFileId,
      ceilingHeight: project.ceilingHeight,
      scale: project.scale,
    }));
  },
});

// Получение проекта по ID
export const getProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      pdfFileId: v.id("_storage"),
      ceilingHeight: v.optional(v.number()),
      scale: v.optional(v.object({
        knownLength: v.number(),
        pixelLength: v.number(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    // Убираем userId из возвращаемых данных
    return {
      _id: project._id,
      _creationTime: project._creationTime,
      name: project.name,
      pdfFileId: project.pdfFileId,
      ceilingHeight: project.ceilingHeight,
      scale: project.scale,
    };
  },
});

// Получение проекта с URL для PDF файла
export const getProjectWithPdfUrl = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      pdfFileId: v.id("_storage"),
      pdfUrl: v.union(v.string(), v.null()),
      ceilingHeight: v.optional(v.number()),
      scale: v.optional(v.object({
        knownLength: v.number(),
        pixelLength: v.number(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    // Генерируем URL для PDF файла
    const pdfUrl = await ctx.storage.getUrl(project.pdfFileId);

    // Убираем userId из возвращаемых данных
    return {
      _id: project._id,
      _creationTime: project._creationTime,
      name: project.name,
      pdfFileId: project.pdfFileId,
      pdfUrl,
      ceilingHeight: project.ceilingHeight,
      scale: project.scale,
    };
  },
});

// Обновление масштаба проекта
export const updateProjectScale = mutation({
  args: {
    projectId: v.id("projects"),
    knownLength: v.number(),
    pixelLength: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    await ctx.db.patch(args.projectId, {
      scale: {
        knownLength: args.knownLength,
        pixelLength: args.pixelLength,
      },
    });

    return null;
  },
});

// Обновление высоты потолков
export const updateCeilingHeight = mutation({
  args: {
    projectId: v.id("projects"),
    ceilingHeight: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    await ctx.db.patch(args.projectId, {
      ceilingHeight: args.ceilingHeight,
    });

    return null;
  },
});

// Получение страниц проекта
export const getProjectPages = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pages"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      pageNumber: v.number(),
      pdfFileId: v.id("_storage"),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();

    return pages;
  },
});

// Гарантированно получить страницу проекта по номеру (создать при отсутствии)
export const ensurePage = mutation({
  args: {
    projectId: v.id("projects"),
    pageNumber: v.number(),
  },
  returns: v.id("pages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    const existing = await ctx.db
      .query("pages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("pageNumber"), args.pageNumber))
      .unique();

    if (existing) return existing._id;

    const pageId = await ctx.db.insert("pages", {
      projectId: args.projectId,
      pageNumber: args.pageNumber,
      pdfFileId: project.pdfFileId,
    });
    return pageId;
  },
});

// Получение этапов страницы
export const getPageStages = query({
  args: {
    pageId: v.id("pages"),
  },
  returns: v.array(
    v.object({
      _id: v.id("stages"),
      _creationTime: v.number(),
      pageId: v.id("pages"),
      stageType: v.union(
        v.literal("measurement"),
        v.literal("installation"),
        v.literal("demolition"),
        v.literal("electrical"),
        v.literal("plumbing"),
        v.literal("finishing"),
        v.literal("materials")
      ),
      data: v.any(),
      isCompleted: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const page = await ctx.db.get(args.pageId);
    if (!page) {
      return [];
    }

    const project = await ctx.db.get(page.projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    const stages = await ctx.db
      .query("stages")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .order("asc")
      .collect();

    return stages;
  },
});

// Создание этапа для страницы
export const createStage = mutation({
  args: {
    pageId: v.id("pages"),
    stageType: v.union(
      v.literal("measurement"),
      v.literal("installation"),
      v.literal("demolition"),
      v.literal("electrical"),
      v.literal("plumbing"),
      v.literal("finishing"),
      v.literal("materials")
    ),
  },
  returns: v.id("stages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const page = await ctx.db.get(args.pageId);
    if (!page) {
      throw new Error("Страница не найдена");
    }

    const project = await ctx.db.get(page.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    return await ctx.db.insert("stages", {
      pageId: args.pageId,
      stageType: args.stageType,
      data: {},
      isCompleted: false,
    });
  },
});

// Обновление данных этапа
export const updateStageData = mutation({
  args: {
    stageId: v.id("stages"),
    data: v.any(),
    isCompleted: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const stage = await ctx.db.get(args.stageId);
    if (!stage) {
      throw new Error("Этап не найден");
    }

    const page = await ctx.db.get(stage.pageId);
    if (!page) {
      throw new Error("Страница не найдена");
    }

    const project = await ctx.db.get(page.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    const updateData: any = { data: args.data };
    if (args.isCompleted !== undefined) {
      updateData.isCompleted = args.isCompleted;
    }

    await ctx.db.patch(args.stageId, updateData);
    return null;
  },
});

// Добавление измерения
export const addMeasurement = mutation({
  args: {
    stageId: v.id("stages"),
    type: v.union(
      v.literal("wall"),
      v.literal("area"),
      v.literal("perimeter"),
      v.literal("point"),
      v.literal("line")
    ),
    coordinates: v.array(v.object({
      x: v.number(),
      y: v.number(),
    })),
    properties: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
  },
  returns: v.id("measurements"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Не авторизован");
    }

    const stage = await ctx.db.get(args.stageId);
    if (!stage) {
      throw new Error("Этап не найден");
    }

    const page = await ctx.db.get(stage.pageId);
    if (!page) {
      throw new Error("Страница не найдена");
    }

    const project = await ctx.db.get(page.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Проект не найден");
    }

    return await ctx.db.insert("measurements", {
      stageId: args.stageId,
      type: args.type,
      coordinates: args.coordinates,
      properties: args.properties,
    });
  },
});

// Получение измерений этапа
export const getStageMeasurements = query({
  args: {
    stageId: v.id("stages"),
  },
  returns: v.array(
    v.object({
      _id: v.id("measurements"),
      _creationTime: v.number(),
      stageId: v.id("stages"),
      type: v.union(
        v.literal("wall"),
        v.literal("area"),
        v.literal("perimeter"),
        v.literal("point"),
        v.literal("line")
      ),
      coordinates: v.array(v.object({
        x: v.number(),
        y: v.number(),
      })),
      properties: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const stage = await ctx.db.get(args.stageId);
    if (!stage) {
      return [];
    }

    const page = await ctx.db.get(stage.pageId);
    if (!page) {
      return [];
    }

    const project = await ctx.db.get(page.projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    const measurements = await ctx.db
      .query("measurements")
      .withIndex("by_stage", (q) => q.eq("stageId", args.stageId))
      .order("asc")
      .collect();

    return measurements;
  },
});

// Внутренняя функция для создания страниц из PDF
export const createPagesFromPdf = internalAction({
  args: {
    projectId: v.id("projects"),
    pdfFileId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Пока создаем одну страницу, позже добавим парсинг PDF
    await ctx.runMutation(internal.projects.createPage, {
      projectId: args.projectId,
      pageNumber: 1,
      pdfFileId: args.pdfFileId,
    });
    return null;
  },
});

// Создание страницы
export const createPage = internalMutation({
  args: {
    projectId: v.id("projects"),
    pageNumber: v.number(),
    pdfFileId: v.id("_storage"),
  },
  returns: v.id("pages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("pages", {
      projectId: args.projectId,
      pageNumber: args.pageNumber,
      pdfFileId: args.pdfFileId,
    });
  },
});

// Копирование дефолтных материалов пользователя в проект
export const copyDefaultMaterialsToProject = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const defaults = await ctx.db
      .query("materialsDefaults")
      .withIndex("by_owner_and_stage", (q) => q.eq("ownerUserId", project.userId))
      .collect();

    for (const row of defaults) {
      await ctx.db.insert("projectMaterials", {
        projectId: args.projectId,
        stageType: row.stageType,
        name: row.name,
        consumptionPerUnit: row.consumptionPerUnit,
        purchasePrice: row.purchasePrice,
        sellPrice: row.sellPrice,
        unit: row.unit,
      });
    }
    return null;
  },
});



 