import { objects } from "../object-data";
import { UpdateObjectSchemaType, CreateShapeSchemaType, DeleteObjectSchemaType, NoArgumentsSchemaType, StoredObjectSchemaType, TextboxSchemaType, StoredObjectSchema } from "./schemas";

export function listObjects(input: NoArgumentsSchemaType) {
    return objects;
}

export function createShape(input: CreateShapeSchemaType) {
    const obj: StoredObjectSchemaType = {
        id: crypto.randomUUID(),
        ...input
    }
    objects.push(obj);

    return {
        message: "shape created",
        obj: obj
    };
}

export function createTextbox(input: TextboxSchemaType) {
    const obj: StoredObjectSchemaType = {
        id: crypto.randomUUID(),
        ...input
    }
    objects.push(obj);

    return {
        message: "textbox created",
        obj: obj
    };
}

export function deleteObject(input: DeleteObjectSchemaType) {
    const index = objects.findIndex((obj) => obj.id === input.id);

    if (index === -1) return { success: false, message: `Object with id ${input.id} not found` };

    objects.splice(index, 1);

    return { success: true, deleted_id: input };
}

export function updateObject(input: UpdateObjectSchemaType) {
    const index = objects.findIndex((obj) => obj.id === input.id);

    if (index === -1) return { success: false, message: `Object with id ${input.id} not found` };

    const updatedObject = {
        ...objects[index],
        ...input.patch
    }

    const parsed = StoredObjectSchema.safeParse(updatedObject)

    if (parsed.success) {
        const originalValues: Record<string, unknown> = {};

        for (const key of Object.keys(input.patch)) {
            originalValues[key] =
                objects[index][key as keyof StoredObjectSchemaType];
        }

        objects[index] = parsed.data;
        return { success: true, old_values: originalValues, new_values: input.patch };
    } else {
        return { success: false, message: "Failed to parse updated object", error: parsed.error };
    }
}

export function getCoordinates(input: NoArgumentsSchemaType) {
    return "test"
}