import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const stageUnion = v.union(
  v.literal("measurement"),
  v.literal("installation"),
  v.literal("demolition"),
  v.literal("markup"),
  v.literal("electrical"),
  v.literal("plumbing"),
  v.literal("finishing"),
  v.literal("materials")
);

const triggerUnion = v.union(
  v.literal("room"),
  v.literal("door"),
  v.literal("window"),
  // Электрика
  v.literal("spotlight"),
  v.literal("bra"),
  v.literal("led"),
  v.literal("outlet"),
  v.literal("switch")
);

export const listDefaults = query({
  args: { stageType: v.optional(stageUnion) },
  returns: v.array(v.object({
    _id: v.id("materialsDefaults"),
    _creationTime: v.number(),
    ownerUserId: v.id("users"),
    stageType: stageUnion,
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    triggerType: v.optional(triggerUnion),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    let q = ctx.db.query("materialsDefaults").withIndex("by_owner_and_stage", (q) => q.eq("ownerUserId", userId));
    const rows = await q.collect();
    return rows.filter(r => !args.stageType || r.stageType === args.stageType);
  },
});

export const upsertDefault = mutation({
  args: {
    id: v.optional(v.id("materialsDefaults")),
    stageType: stageUnion,
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    triggerType: v.optional(triggerUnion),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Не авторизован");
    if (args.id) {
      await ctx.db.patch(args.id, {
        stageType: args.stageType,
        name: args.name,
        consumptionPerUnit: args.consumptionPerUnit,
        purchasePrice: args.purchasePrice,
        sellPrice: args.sellPrice,
        unit: args.unit,
        triggerType: args.triggerType,
      });
    } else {
      await ctx.db.insert("materialsDefaults", {
        ownerUserId: userId,
        stageType: args.stageType,
        name: args.name,
        consumptionPerUnit: args.consumptionPerUnit,
        purchasePrice: args.purchasePrice,
        sellPrice: args.sellPrice,
        unit: args.unit,
        triggerType: args.triggerType,
      });
    }
    return null;
  },
});

export const listProjectMaterials = query({
  args: { projectId: v.id("projects"), stageType: v.optional(stageUnion) },
  returns: v.array(v.object({
    _id: v.id("projectMaterials"),
    _creationTime: v.number(),
    projectId: v.id("projects"),
    stageType: stageUnion,
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    triggerType: v.optional(triggerUnion),
  })),
  handler: async (ctx, args) => {
    let q = ctx.db.query("projectMaterials").withIndex("by_project_and_stage", (q) => q.eq("projectId", args.projectId));
    const rows = await q.collect();
    return rows.filter(r => !args.stageType || r.stageType === args.stageType);
  },
});

export const upsertProjectMaterial = mutation({
  args: {
    id: v.optional(v.id("projectMaterials")),
    projectId: v.id("projects"),
    stageType: stageUnion,
    name: v.string(),
    consumptionPerUnit: v.number(),
    purchasePrice: v.number(),
    sellPrice: v.number(),
    unit: v.optional(v.string()),
    triggerType: v.optional(triggerUnion),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.id) {
      await ctx.db.patch(args.id, {
        stageType: args.stageType,
        name: args.name,
        consumptionPerUnit: args.consumptionPerUnit,
        purchasePrice: args.purchasePrice,
        sellPrice: args.sellPrice,
        unit: args.unit,
        triggerType: args.triggerType,
      });
    } else {
      await ctx.db.insert("projectMaterials", {
        projectId: args.projectId,
        stageType: args.stageType,
        name: args.name,
        consumptionPerUnit: args.consumptionPerUnit,
        purchasePrice: args.purchasePrice,
        sellPrice: args.sellPrice,
        unit: args.unit,
        triggerType: args.triggerType,
      });
    }
    return null;
  },
});

