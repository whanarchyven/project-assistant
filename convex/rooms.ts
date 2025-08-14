import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

export const listRoomTypes = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("roomTypes"),
    _creationTime: v.number(),
    ownerUserId: v.id("users"),
    name: v.string(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("roomTypes")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
      .collect();
  },
});

export const upsertRoomType = mutation({
  args: { id: v.optional(v.id("roomTypes")), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");
    if (args.id) {
      await ctx.db.patch(args.id, { name: args.name });
    } else {
      await ctx.db.insert("roomTypes", { ownerUserId: userId, name: args.name });
    }
    return null;
  },
});

export const deleteRoomType = mutation({
  args: { id: v.id("roomTypes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const listRoomTypeMaterials = query({
  args: { roomTypeId: v.id("roomTypes") },
  returns: v.array(v.object({
    _id: v.id("roomTypeMaterials"),
    _creationTime: v.number(),
    ownerUserId: v.id("users"),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.union(v.literal('floor_m2'), v.literal('wall_m2')),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("roomTypeMaterials")
      .withIndex("by_owner_and_room_type", (q) => q.eq("ownerUserId", userId).eq("roomTypeId", args.roomTypeId))
      .collect();
  },
});

export const upsertRoomTypeMaterial = mutation({
  args: {
    id: v.optional(v.id("roomTypeMaterials")),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.union(v.literal('floor_m2'), v.literal('wall_m2')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");
    if (args.id) {
      await ctx.db.patch(args.id, { name: args.name, consumptionPerUnit: args.consumptionPerUnit, purchasePrice: args.purchasePrice, sellPrice: args.sellPrice, unit: args.unit, basis: args.basis });
    } else {
      await ctx.db.insert("roomTypeMaterials", { ownerUserId: userId, roomTypeId: args.roomTypeId, name: args.name, consumptionPerUnit: args.consumptionPerUnit, purchasePrice: args.purchasePrice, sellPrice: args.sellPrice, unit: args.unit, basis: args.basis });
    }
    return null;
  },
});

export const createRoom = mutation({
  args: {
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    elementId: v.id("svgElements"),
    name: v.string(),
    roomTypeId: v.id("roomTypes"),
  },
  returns: v.id("rooms"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("rooms", args);
  },
});

export const listRoomsByPage = query({
  args: { pageId: v.id("pages") },
  returns: v.array(v.object({
    _id: v.id("rooms"),
    _creationTime: v.number(),
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    elementId: v.id("svgElements"),
    name: v.string(),
    roomTypeId: v.id("roomTypes"),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
  },
});

export const listRoomsByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    _id: v.id("rooms"),
    _creationTime: v.number(),
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    elementId: v.id("svgElements"),
    name: v.string(),
    roomTypeId: v.id("roomTypes"),
  })),
  handler: async (ctx, args) => {
    const pages = await ctx.db.query("pages").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect();
    const res: Array<any> = [];
    for (const p of pages) {
      const rows = await ctx.db.query("rooms").withIndex("by_page", (q) => q.eq("pageId", p._id)).collect();
      res.push(...rows);
    }
    return res;
  },
});

export const getRoomsWithGeometryByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({
    roomId: v.id("rooms"),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
  })),
  handler: async (ctx, args) => {
    const rooms = await ctx.runQuery(api.rooms.listRoomsByProject, { projectId: args.projectId } as any);
    const out: Array<any> = [];
    for (const r of rooms as any[]) {
      const el: any = await ctx.db.get(r.elementId);
      const pts = (el?.data?.points ?? []) as Array<{ x: number; y: number }>;
      if (Array.isArray(pts) && pts.length >= 3) {
        out.push({ roomId: r._id, roomTypeId: r.roomTypeId, name: r.name, points: pts });
      }
    }
    return out;
  },
});

export const listAllRoomTypeMaterials = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("roomTypeMaterials"),
    _creationTime: v.number(),
    ownerUserId: v.id("users"),
    roomTypeId: v.id("roomTypes"),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.union(v.literal('floor_m2'), v.literal('wall_m2')),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("roomTypeMaterials")
      .withIndex("by_owner_and_room_type", (q) => q.eq("ownerUserId", userId))
      .collect();
  },
});

// Материалы для предустановленных проёмов (дверь/окно/проём)
export const listOpeningMaterials = query({
  args: { openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')) },
  returns: v.array(v.object({
    _id: v.id('openingMaterials'),
    _creationTime: v.number(),
    ownerUserId: v.id('users'),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.union(v.literal('opening_m2'), v.literal('per_opening')),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query('openingMaterials').withIndex('by_owner_and_type', (q) => q.eq('ownerUserId', userId).eq('openingType', args.openingType)).collect();
  },
});

export const upsertOpeningMaterial = mutation({
  args: {
    id: v.optional(v.id('openingMaterials')),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    basis: v.optional(v.union(v.literal('opening_m2'), v.literal('per_opening'))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Не авторизован');
    if (args.id) {
      await ctx.db.patch(args.id, { name: args.name, consumptionPerUnit: args.consumptionPerUnit, purchasePrice: args.purchasePrice, sellPrice: args.sellPrice, unit: args.unit, ...(args.basis ? { basis: args.basis } : {}) });
    } else {
      await ctx.db.insert('openingMaterials', { ownerUserId: userId, openingType: args.openingType, name: args.name, consumptionPerUnit: args.consumptionPerUnit, purchasePrice: args.purchasePrice, sellPrice: args.sellPrice, unit: args.unit, basis: args.basis ?? 'opening_m2' });
    }
    return null;
  }
});

export const createOpening = mutation({
  args: {
    projectId: v.id('projects'),
    pageId: v.id('pages'),
    elementId: v.id('svgElements'),
    roomId1: v.id('rooms'),
    roomId2: v.optional(v.id('rooms')),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    heightMm: v.number(),
    lengthPx: v.number(),
  },
  returns: v.id('openings'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('openings', args);
  }
});

export const listOpeningsByProject = query({
  args: { projectId: v.id('projects') },
  returns: v.array(v.object({
    _id: v.id('openings'),
    _creationTime: v.number(),
    projectId: v.id('projects'),
    pageId: v.id('pages'),
    elementId: v.id('svgElements'),
    roomId1: v.id('rooms'),
    roomId2: v.optional(v.id('rooms')),
    openingType: v.union(v.literal('door'), v.literal('window'), v.literal('opening')),
    heightMm: v.number(),
    lengthPx: v.number(),
  })),
  handler: async (ctx, args) => {
    const pages = await ctx.db.query('pages').withIndex('by_project', (q)=> q.eq('projectId', args.projectId)).collect();
    const out: any[] = [];
    for (const p of pages) {
      const rows = await ctx.db.query('openings').withIndex('by_page', (q)=> q.eq('pageId', p._id)).collect();
      out.push(...rows);
    }
    return out;
  }
});

export const updateOpening = mutation({
  args: {
    openingId: v.id('openings'),
    heightMm: v.optional(v.number()),
    lengthPx: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.heightMm !== undefined) updates.heightMm = args.heightMm;
    if (args.lengthPx !== undefined) updates.lengthPx = args.lengthPx;
    await ctx.db.patch(args.openingId, updates);
    return null;
  }
});

export const deleteOpening = mutation({
  args: { openingId: v.id('openings') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.openingId);
    return null;
  }
});

// Удаление комнаты с каскадным удалением проёмов, связанных с ней (roomId1 или roomId2)
export const deleteRoomCascade = mutation({
  args: { roomId: v.id('rooms') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return null;
    // Удалим все проёмы на той же странице, где участвует эта комната
    const openings = await ctx.db
      .query('openings')
      .withIndex('by_page', (q)=> q.eq('pageId', room.pageId))
      .collect();
    for (const op of openings) {
      if (op.roomId1 === args.roomId || op.roomId2 === args.roomId) {
        await ctx.db.delete(op._id);
      }
    }
    // Удаляем саму комнату
    await ctx.db.delete(args.roomId);
    return null;
  }
});

export const clearOpeningsByPage = mutation({
  args: { pageId: v.id('pages') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('openings').withIndex('by_page', (q)=> q.eq('pageId', args.pageId)).collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return null;
  }
});


