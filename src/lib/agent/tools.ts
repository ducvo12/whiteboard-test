import "server-only";

import { z } from "zod";
import { CreateObjectSchema } from "../whiteboard/schemas";
import { createObject, listObjects } from "../whiteboard/services";

const NoArgumentsSchema = z.strictObject({});

export interface Tool {
    tool_name: string;
    tool_description: string;
    arguments: Record<string, any>;
    inputSchema: z.ZodType<any>;
    execute: (args?: any) => any;
}

export const toolDescriptions: Tool[] = [
    {
        tool_name: "get_shapes",
        tool_description: "returns a list of all shapes currently on the whiteboard",
        arguments: z.toJSONSchema(NoArgumentsSchema),
        inputSchema: NoArgumentsSchema,
        execute: listObjects,
    },
    {
        tool_name: "add_shape",
        tool_description: "adds a either a rect, circle, or polygon to the canvas",
        arguments: z.toJSONSchema(CreateObjectSchema),
        inputSchema: CreateObjectSchema,
        execute: createObject
    }
]