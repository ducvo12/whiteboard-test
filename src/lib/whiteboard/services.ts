import { getBoardRepository } from "./document-store";
import { UpdateObjectSchemaType, CreateShapeSchemaType, DeleteObjectSchemaType, NoArgumentsSchemaType, StoredObjectSchemaType, TextboxSchemaType, StoredObjectSchema } from "./schemas";

export function listObjects(input: NoArgumentsSchemaType) {
    return getBoardRepository().view();
}

export function createShape(input: CreateShapeSchemaType, id = crypto.randomUUID()) {
    const obj: StoredObjectSchemaType = {
        id,
        ...input
    }
    getBoardRepository().enqueue({kind:"put",object:obj});

    return {
        message: "shape created",
        obj: obj
    };
}

export function createTextbox(input: TextboxSchemaType, id = crypto.randomUUID()) {
    const obj: StoredObjectSchemaType = {
        id,
        ...input
    }
    getBoardRepository().enqueue({kind:"put",object:obj});

    return {
        message: "textbox created",
        obj: obj
    };
}

export function deleteObject(input: DeleteObjectSchemaType) {
    const objects = getBoardRepository().view();
    const index = objects.findIndex((obj) => obj.id === input.id);

    if (index === -1) return { success: false, message: `Object with id ${input.id} not found` };

    getBoardRepository().enqueue({kind:"delete",id:input.id});

    return { success: true, deleted_id: input };
}

export function clearObjects() {
    getBoardRepository().enqueue({kind:"clear"});
    return { success: true };
}

export function updateObject(input: UpdateObjectSchemaType) {
    const objects = getBoardRepository().view();
    const index = objects.findIndex((obj) => obj.id === input.id);

    if (index === -1) return { success: false, message: `Object with id ${input.id} not found` };

    const current = objects[index];
    const updatedObject = {
        ...current,
        ...input.patch,
        rotation: input.patch.rotation ?? current.rotation ?? 0,
    };

    const parsed = StoredObjectSchema.safeParse(updatedObject)

    if (parsed.success) {
        const originalValues: Record<string, unknown> = {};

        for (const key of Object.keys(input.patch)) {
            originalValues[key] =
                objects[index][key as keyof StoredObjectSchemaType];
        }

        getBoardRepository().enqueue({kind:"put",object:parsed.data});
        return { success: true, old_values: originalValues, new_values: input.patch };
    } else {
        return { success: false, message: "Failed to parse updated object", error: parsed.error };
    }
}

export function getCoordinates(input: NoArgumentsSchemaType) {
    return "test"
}
