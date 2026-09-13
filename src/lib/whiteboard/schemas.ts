import { z } from "zod";

const ShapeBaseSchema = z.object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    strokeColor: z.string().min(1),
    fillColor: z.string().min(1),
    fillOpacity: z.number().min(0).max(1).optional(),
    strokeWidth: z.number().nonnegative(),
});

export const CircleSchema = ShapeBaseSchema.extend({
    shape: z.literal("circle"),
    r: z.number().positive(),
});

export const RectSchema = ShapeBaseSchema.extend({
    shape: z.literal("rect"),
    w: z.number().positive(),
    h: z.number().positive()
})

export const PolygonSchema = ShapeBaseSchema.extend({
    shape: z.literal("polygon"),
    points: z.array(z.object({
        x: z.number(),
        y: z.number()
    })).min(3)
})

const BoardObjectSchema = z.discriminatedUnion("shape", [CircleSchema, RectSchema, PolygonSchema]);

export type ShapeBaseSchemaValue = z.infer<typeof ShapeBaseSchema>;
export type CircleSchemaValue = z.infer<typeof CircleSchema>;
export type RectSchemaValue = z.infer<typeof RectSchema>;
export type PolygonSchemaValue = z.infer<typeof PolygonSchema>;
export type BoardObjectSchemaValue = z.infer<typeof BoardObjectSchema>;
