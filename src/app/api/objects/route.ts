import { BoardObjectSchema, DeleteObjectSchema, UpdateObjectSchema } from "@/lib/whiteboard/schemas";
import { createShape, createTextbox, deleteObject, listObjects, updateObject } from "@/lib/whiteboard/services";

export async function GET() {
    return Response.json([...listObjects({})], { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
    const newItem = await request.json();
    if (newItem && typeof newItem === "object" && !("rotation" in newItem)) {
        newItem.rotation = 0;
    }
    const parsed = BoardObjectSchema.safeParse(newItem);

    if (!parsed.success) {
        return Response.json({ error: parsed.error }, { status: 400 })
    }

    // Browser-generated IDs make a retried create safe. Agent callers still get UUIDs.
    const id = typeof newItem.id === "string" && newItem.id.length > 0 ? newItem.id : undefined;
    const existing = id && listObjects({}).find((item) => item.id === id);
    if (existing) return Response.json(existing);

    const created = parsed.data.object === "textbox"
        ? createTextbox(parsed.data, id)
        : createShape(parsed.data, id);

    return Response.json(created.obj);
}

export async function PATCH(request: Request) {
    const updateObjectRequest = await request.json();

    const parsed = UpdateObjectSchema.safeParse(updateObjectRequest);

    if (parsed.success) {
        const current = listObjects({}).find((item) => item.id === parsed.data.id);
        if (!current && updateObjectRequest.expected) return Response.json({ error: "This object was deleted elsewhere." }, { status: 409 });
        if (updateObjectRequest.expected && current) {
            const values = current as unknown as Record<string, unknown>;
            const conflict = Object.entries(updateObjectRequest.expected).some(([key, value]) =>
                JSON.stringify(values[key] ?? null) !== JSON.stringify(value ?? null) &&
                JSON.stringify(values[key] ?? null) !== JSON.stringify((parsed.data.patch as Record<string, unknown>)[key] ?? null));
            if (conflict) return Response.json({ error: "This object was changed elsewhere. The server version was kept." }, { status: 409 });
        }
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

    const parsed = DeleteObjectSchema.safeParse({ id: deleteObjectRequest?.id });

    if (parsed.success) {
        const current = listObjects({}).find((item) => item.id === parsed.data.id);
        if (!current && deleteObjectRequest.expected) return Response.json({ success: true });
        if (current && deleteObjectRequest.expected && JSON.stringify(current) !== JSON.stringify(deleteObjectRequest.expected)) {
            return Response.json({ error: "This object changed before deletion. The server version was kept." }, { status: 409 });
        }
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
