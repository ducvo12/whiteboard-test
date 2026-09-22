import "server-only";

import { z } from "zod";
import { CreateShapeSchema, DeleteObjectSchema, NoArgumentsSchema, TextboxSchema, UpdateObjectSchema } from "../whiteboard/schemas";
import { createShape, createTextbox, deleteObject, getCoordinates, listObjects, updateObject } from "../whiteboard/services";

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
        arguments: z.toJSONSchema(CreateShapeSchema),
        inputSchema: CreateShapeSchema,
        execute: createShape
    },
    {
        tool_name: "add_textbox",
        tool_description: "adds a textbox to the canvas.",
        arguments: z.toJSONSchema(TextboxSchema),
        inputSchema: TextboxSchema,
        execute: createTextbox
    },
    {
        tool_name: "delete_object",
        tool_description: "delete an object with a given id",
        arguments: z.toJSONSchema(DeleteObjectSchema),
        inputSchema: DeleteObjectSchema,
        execute: deleteObject
    },
    {
        tool_name: "update_object",
        tool_description: "update an object with a given id",
        arguments: z.toJSONSchema(UpdateObjectSchema),
        inputSchema: UpdateObjectSchema,
        execute: updateObject
    },
    {
        tool_name: "get_corner_coordinates",
        tool_description: "get coordinates of bottom-left and top-right of exposed screen",
        arguments: z.toJSONSchema(NoArgumentsSchema),
        inputSchema: NoArgumentsSchema,
        execute: getCoordinates
    }
]