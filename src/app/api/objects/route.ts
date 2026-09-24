import { BoardObjectSchema, DeleteObjectSchema, UpdateObjectSchema } from "@/lib/whiteboard/schemas";
import { createShape, createTextbox, deleteObject, listObjects, updateObject } from "@/lib/whiteboard/services";

export async function GET() {
    return Response.json([...listObjects({})]);
}

export async function PUT(request: Request) {
    const newItem = await request.json();
    const parsed = BoardObjectSchema.safeParse(newItem);

    if (!parsed.success) {
        return Response.json({ error: parsed.error }, { status: 400 })
    }

    const created = parsed.data.object === "textbox"
        ? createTextbox(parsed.data)
        : createShape(parsed.data);

    return Response.json(created.obj);
}

export async function PATCH(request: Request) {
    const updateObjectRequest = await request.json();

    const parsed = UpdateObjectSchema.safeParse(updateObjectRequest);

    if (parsed.success) {
        const response = updateObject(parsed.data);

        if (response.success) {
            return Response.json(response);
        } else {
            return Response.json({ error: response.message }, { status: 400 });
        }
    } else {
        return Response.json({ error: parsed.error }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const deleteObjectRequest = await request.json();

    const parsed = DeleteObjectSchema.safeParse(deleteObjectRequest);

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