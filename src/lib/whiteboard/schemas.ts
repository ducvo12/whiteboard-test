import { z } from "zod";

const ShapeBaseSchema = z.object({
    x: z.number().describe("World X. Origin is bottom-left; X increases to the right."),
    y: z.number().describe("World Y. Origin is bottom-left; Y increases upward. Larger y is visually above; smaller y is visually below."),
    strokeColor: z.string().min(1),
    fillColor: z.string().min(1),
    fillOpacity: z.number().min(0).max(1).optional(),
    strokeWidth: z.number().nonnegative(),
});

export const CircleSchema = ShapeBaseSchema.extend({
    shape: z.literal("circle"),
    r: z.number().positive(),
}).describe("Circle. (x, y) is the center in world coordinates (y-up).");

export const RectSchema = ShapeBaseSchema.extend({
    shape: z.literal("rect"),
    w: z.number().positive(),
    h: z.number().positive()
}).describe("Rectangle. (x, y) is the bottom-left corner in world coordinates (y-up). The rectangle extends right by w and up by h.");

export const PolygonSchema = ShapeBaseSchema.extend({
    shape: z.literal("polygon"),
    points: z.array(z.object({
        x: z.number().describe("Vertex world X. Origin is bottom-left; X increases to the right."),
        y: z.number().describe("Vertex world Y. Origin is bottom-left; Y increases upward."),
    })).min(3).describe("Absolute world vertices. Y increases upward, so a vertex with a larger y is visually above one with a smaller y.")
}).describe("Polygon. Drawn from points in world coordinates (y-up). (x, y) should match the first point.");

const StoredShapeSchema = z.object({
    id: z.string().min(1),
});

export type ShapeBaseSchemaValue = z.infer<typeof ShapeBaseSchema>;
export type CircleSchemaValue = z.infer<typeof CircleSchema>;
export type RectSchemaValue = z.infer<typeof RectSchema>;
export type PolygonSchemaValue = z.infer<typeof PolygonSchema>;

export const CreateObjectSchema = z.discriminatedUnion("shape", [CircleSchema, RectSchema, PolygonSchema]);
export type CreateObjectSchemaValue = z.infer<typeof CreateObjectSchema>;

export const StoredObjectSchema = z.intersection(StoredShapeSchema, CreateObjectSchema)
export type StoredObjectSchemaValue = z.infer<typeof StoredObjectSchema>;

export const DeleteObjectSchema = z.strictObject({
    id: z.string().min(1)
})
export type DeleteObjectSchemaValue = z.infer<typeof DeleteObjectSchema>;

export const NoArgumentsSchema = z.strictObject({});
export type NoArgumentsSchemaValue = z.infer<typeof NoArgumentsSchema>;