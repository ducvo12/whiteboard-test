import { objects } from "../object-data";
import { CreateObjectSchemaValue, StoredObjectSchemaValue } from "./schemas";

export function listObjects() {
    return objects;
}

export function createObject(input: CreateObjectSchemaValue) {
    const obj: StoredObjectSchemaValue = {
        id: crypto.randomUUID(),
        ...input
    }
    objects.push(obj);

    return {
        message: "shape created",
        shape: obj
    };
}

export function deleteObject(id: string) {
    const index = objects.findIndex((obj) => obj.id === id);

    if (index === -1) return { success: false, message: "Object not found" };

    objects.splice(index, 1);

    return { success: true };
}