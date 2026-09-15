import "server-only";

import { z } from "zod";
import { CreateObjectSchema } from "../whiteboard/schemas";
import { createObject } from "../whiteboard/services";

export const toolDescriptions = [
    {
        tool_name: "add_shape",
        tool_description: "adds a either a rect, circle, or polygon to the canvas",
        arguments: z.toJSONSchema(CreateObjectSchema),
        inputSchema: CreateObjectSchema,
        execute: createObject
    }
]