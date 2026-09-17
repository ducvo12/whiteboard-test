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

export const TextboxSchema = ShapeBaseSchema.extend({
    shape: z.literal("textbox"),
    w: z.number().positive(),
    h: z.number().positive(),
    text: z.string().min(1).describe("Text shown inside the box."),
    fontSize: z.number().positive().describe("Font size in world units (same space as w and h)."),
    textColor: z.string().min(1),
}).describe("Textbox. (x, y) is the bottom-left corner in world coordinates (y-up). The box extends right by w and up by h. Text is drawn inside that box.");

const StoredShapeSchema = z.object({
    id: z.string().min(1),
});

export type ShapeBaseSchemaValue = z.infer<typeof ShapeBaseSchema>;
export type CircleSchemaValue = z.infer<typeof CircleSchema>;
export type RectSchemaValue = z.infer<typeof RectSchema>;
export type PolygonSchemaValue = z.infer<typeof PolygonSchema>;
export type TextboxSchemaValue = z.infer<typeof TextboxSchema>;

export const CreateObjectSchema = z.discriminatedUnion("shape", [CircleSchema, RectSchema, PolygonSchema]);
export type CreateObjectSchemaValue = z.infer<typeof CreateObjectSchema>;

export const BoardObjectSchema = z.discriminatedUnion("shape", [CircleSchema, RectSchema, PolygonSchema, TextboxSchema]);
export type BoardObjectSchemaValue = z.infer<typeof BoardObjectSchema>;

export const StoredObjectSchema = z.intersection(StoredShapeSchema, BoardObjectSchema)
export type StoredObjectSchemaValue = z.infer<typeof StoredObjectSchema>;

export const DeleteObjectSchema = z.strictObject({
    id: z.string().min(1)
})
export type DeleteObjectSchemaValue = z.infer<typeof DeleteObjectSchema>;

export const NoArgumentsSchema = z.strictObject({});
export type NoArgumentsSchemaValue = z.infer<typeof NoArgumentsSchema>;