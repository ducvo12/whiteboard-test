import { objects } from "@/lib/object-data";
import { CreateObjectSchema, DeleteObjectSchema } from "@/lib/whiteboard/schemas";
import { createObject, deleteObject, listObjects } from "@/lib/whiteboard/services";

export async function GET() {
    return Response.json([...listObjects({})]);
}

export async function PUT(request: Request) {
    const newItem = await request.json();
    const parsed = CreateObjectSchema.safeParse(newItem);

    if (parsed.success) {
        return Response.json(createObject(parsed.data).shape);
    } else {
        return Response.json({ error: parsed.error }, { status: 400 })
    }
}

export async function PATCH(request: Request) {
    const { id, ...updates } = await request.json();

    const index = objects.findIndex(object => object.id === id);

    if (index !== -1) {
        objects[index] = { ...objects[index], ...updates };
    }

    return Response.json(objects[index]);
}

export async function DELETE(request: Request) {
    const deleteObject = await request.json();

    const parsed = DeleteObjectSchema.safeParse(deleteObject);

    if (parsed.success) {
        const response = deleteObject(parsed.data);

        if (response.success) {
            return Response.json(response);
        } else {
            return Response.json({ error: response.message }, { status: 400 });
        }
    } else {
        return Response.json({ error: parsed.error }, { status: 400 });
    }
}