import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Получить все SVG элементы для страницы и этапа
export const getSvgElements = query({
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
  returns: v.array(v.object({
    _id: v.id("svgElements"),
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
    elementType: v.union(
      v.literal("line"),
      v.literal("rectangle"),
      v.literal("circle"),
      v.literal("text"),
      v.literal("polygon")
    ),
    data: v.any(),
    style: v.object({
      stroke: v.string(),
      strokeWidth: v.number(),
      fill: v.string(),
      opacity: v.number(),
    }),
    order: v.number(),
  })),
  handler: async (ctx, args) => {
    const elements = await ctx.db
      .query("svgElements")
      .withIndex("by_page_and_stage", (q) =>
        q.eq("pageId", args.pageId).eq("stageType", args.stageType)
      )
      .order("asc")
      .collect();

    return elements;
  },
});

// Создать новый SVG элемент
export const createSvgElement = mutation({
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
    elementType: v.union(
      v.literal("line"),
      v.literal("rectangle"),
      v.literal("circle"),
      v.literal("text"),
      v.literal("polygon")
    ),
    data: v.any(),
    style: v.object({
      stroke: v.string(),
      strokeWidth: v.number(),
      fill: v.string(),
      opacity: v.number(),
    }),
  },
  returns: v.id("svgElements"),
  handler: async (ctx, args) => {
    // Получаем максимальный порядок для данного этапа
    const existingElements = await ctx.db
      .query("svgElements")
      .withIndex("by_page_and_stage", (q) =>
        q.eq("pageId", args.pageId).eq("stageType", args.stageType)
      )
      .collect();

    const maxOrder = existingElements.length > 0 
      ? Math.max(...existingElements.map(el => el.order))
      : 0;

    const elementId = await ctx.db.insert("svgElements", {
      pageId: args.pageId,
      stageType: args.stageType,
      elementType: args.elementType,
      data: args.data,
      style: args.style,
      order: maxOrder + 1,
    });

    return elementId;
  },
});

// Обновить SVG элемент
export const updateSvgElement = mutation({
  args: {
    elementId: v.id("svgElements"),
    data: v.optional(v.any()),
    style: v.optional(v.object({
      stroke: v.string(),
      strokeWidth: v.number(),
      fill: v.string(),
      opacity: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.data !== undefined) {
      updates.data = args.data;
    }
    
    if (args.style !== undefined) {
      updates.style = args.style;
    }

    await ctx.db.patch(args.elementId, updates);
    return null;
  },
});

// Удалить SVG элемент
export const deleteSvgElement = mutation({
  args: {
    elementId: v.id("svgElements"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.elementId);
    return null;
  },
});

// Удалить все SVG элементы для страницы и этапа
export const clearSvgElements = mutation({
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const elements = await ctx.db
      .query("svgElements")
      .withIndex("by_page_and_stage", (q) =>
        q.eq("pageId", args.pageId).eq("stageType", args.stageType)
      )
      .collect();

    for (const element of elements) {
      await ctx.db.delete(element._id);
    }

    return null;
  },
});

// Обновить порядок элементов
export const reorderSvgElements = mutation({
  args: {
    elementIds: v.array(v.id("svgElements")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (let i = 0; i < args.elementIds.length; i++) {
      await ctx.db.patch(args.elementIds[i], { order: i + 1 });
    }
    return null;
  },
}); 

// Сводка по прямоугольникам этапа для всего проекта (в пикселях)
export const getStageSummaryByProject = query({
  args: {
    projectId: v.id("projects"),
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
  returns: v.object({
    totalAreaPx2: v.number(),
    totalLengthPx: v.number(),
  }),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    let totalAreaPx2 = 0;
    let totalLengthPx = 0;

    for (const page of pages) {
      const elements = await ctx.db
        .query("svgElements")
        .withIndex("by_page_and_stage", (q) =>
          q.eq("pageId", page._id).eq("stageType", args.stageType)
        )
        .collect();

      for (const el of elements) {
        if (el.elementType === "rectangle") {
          const { width, height } = el.data ?? {};
          if (
            typeof width === "number" &&
            typeof height === "number" &&
            !Number.isNaN(width) &&
            !Number.isNaN(height)
          ) {
            const w = Math.abs(width);
            const h = Math.abs(height);
            totalAreaPx2 += w * h;
            totalLengthPx += Math.max(w, h);
          }
        }
      }
    }

    return { totalAreaPx2, totalLengthPx };
  },
});