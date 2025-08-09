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
      v.literal("markup"),
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
      v.literal("markup"),
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
    semanticType: v.optional(v.union(v.literal("room"), v.literal("door"), v.literal("window"))),
    order: v.number(),
  })),
  handler: async (ctx, args) => {
    const elements = await ctx.db
      .query("svgElements")
      .withIndex("by_page_and_stage", (q) => q.eq("pageId", args.pageId).eq("stageType", args.stageType as unknown as any))
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
      v.literal("markup"),
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
    semanticType: v.optional(v.union(v.literal("room"), v.literal("door"), v.literal("window"))),
  },
  returns: v.id("svgElements"),
  handler: async (ctx, args) => {
    // Получаем максимальный порядок для данного этапа
    const existingElements = await ctx.db
      .query("svgElements")
      .withIndex("by_page_and_stage", (q) => q.eq("pageId", args.pageId).eq("stageType", args.stageType as any))
      .collect();

    const maxOrder = existingElements.length > 0 
      ? Math.max(...existingElements.map(el => el.order))
      : 0;

    const elementId = await ctx.db.insert("svgElements", {
      pageId: args.pageId,
      stageType: args.stageType as any,
      elementType: args.elementType,
      data: args.data,
      style: args.style,
      semanticType: args.semanticType,
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
      v.literal("markup"),
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
      v.literal("markup"),
      v.literal("electrical"),
      v.literal("plumbing"),
      v.literal("finishing"),
      v.literal("materials")
    ),
  },
  returns: v.union(
    v.object({ totalAreaPx2: v.number(), totalLengthPx: v.number() }),
    v.object({
      totalAreaPx2: v.number(),
      totalLengthPx: v.number(),
      rooms: v.object({ areaPx2: v.number(), perimeterPx: v.number() }),
      doors: v.object({ areaPx2: v.number() }),
      windows: v.object({ areaPx2: v.number() }),
    })
  ),
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    let totalAreaPx2 = 0;
    let totalLengthPx = 0;
    let roomsPerimeterPx = 0, roomsAreaPx2 = 0, doorsAreaPx2 = 0, windowsAreaPx2 = 0;

    for (const page of pages) {
      const elements = await ctx.db
        .query("svgElements")
        .withIndex("by_page_and_stage", (q) => q.eq("pageId", page._id).eq("stageType", args.stageType as any))
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
            if (args.stageType === 'markup') {
              const area = w * h;
              if (el.semanticType === 'door') doorsAreaPx2 += area;
              if (el.semanticType === 'window') windowsAreaPx2 += area;
            }
          }
        }
        if (args.stageType === 'markup' && el.elementType === 'polygon') {
          const pts = el.data?.points ?? [];
          if (Array.isArray(pts) && pts.length >= 3) {
            let perim = 0; let area2 = 0;
            for (let i = 0; i < pts.length; i++) {
              const a = pts[i], b = pts[(i+1)%pts.length];
              perim += Math.hypot(b.x - a.x, b.y - a.y);
              area2 += (a.x * b.y - b.x * a.y);
            }
            roomsPerimeterPx += perim;
            roomsAreaPx2 += Math.abs(area2) / 2;
          }
        }
      }
    }

    if (args.stageType === 'markup') {
      return {
        totalAreaPx2,
        totalLengthPx,
        rooms: { areaPx2: roomsAreaPx2, perimeterPx: roomsPerimeterPx },
        doors: { areaPx2: doorsAreaPx2 },
        windows: { areaPx2: windowsAreaPx2 },
      };
    }
    return { totalAreaPx2, totalLengthPx };
  },
});