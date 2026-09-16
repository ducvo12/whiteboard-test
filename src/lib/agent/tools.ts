import "server-only";

import { z } from "zod";
import { CreateObjectSchema, DeleteObjectSchema } from "../whiteboard/schemas";
import { createObject, deleteObject, listObjects } from "../whiteboard/services";

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
        tool_name: "get_objects",
        tool_description: "returns a list of all objects currently on the whiteboard.",
        arguments: z.toJSONSchema(NoArgumentsSchema),
        inputSchema: NoArgumentsSchema,
        execute: listObjects,
    },
    {
        tool_name: "add_shape",
        tool_description: "adds either a rect, circle, or polygon to the canvas.",
        arguments: z.toJSONSchema(CreateObjectSchema),
        inputSchema: CreateObjectSchema,
        execute: createObject
    },
    {
        tool_name: "delete_object",
        tool_description: "delete an object with a given id",
        arguments: z.toJSONSchema(DeleteObjectSchema),
        inputSchema: DeleteObjectSchema,
        execute: deleteObject
    }
]