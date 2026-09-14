import { objects } from "@/lib/object-data";
import { CreateObjectSchema } from "@/lib/whiteboard/schemas";
import { createObject, listObjects } from "@/lib/whiteboard/services";

export async function GET() {
    return Response.json([...listObjects()]);
}

export async function PUT(request: Request) {
    const newItem = await request.json();
    const parsed = CreateObjectSchema.safeParse(newItem);

    if (parsed.success) {
        return Response.json(createObject(parsed.data));
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
    const { id } = await request.json();

    const index = objects.findIndex(object => object.id === id);

    if (index !== -1) {
        objects.splice(index, 1);
    }

    return Response.json({ success: true });
}