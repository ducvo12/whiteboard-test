import { objects } from "../object-data";
import { CreateObjectSchemaValue, DeleteObjectSchemaValue, NoArgumentsSchemaValue, StoredObjectSchemaValue, TextboxSchemaValue } from "./schemas";

export function listObjects(input: NoArgumentsSchemaValue) {
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

export function createTextbox(input: TextboxSchemaValue) {
    const obj: StoredObjectSchemaValue = {
        id: crypto.randomUUID(),
        ...input
    }
    objects.push(obj);

    return {
        message: "textbox created",
        shape: obj
    };
}

export function deleteObject(input: DeleteObjectSchemaValue) {
    const index = objects.findIndex((obj) => obj.id === input.id);

    if (index === -1) return { success: false, message: `Object with id ${input.id} not found` };

    objects.splice(index, 1);

    return { success: true };
}

export function getCoordinates(input: NoArgumentsSchemaValue) {
    return "test"
}