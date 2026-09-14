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

    return obj;
}