import { objects } from "@/lib/object-data";
import { ListObjects } from "@/lib/whiteboard/services";

export async function GET() {
    const objs = ListObjects();
    return Response.json(objs);
}

export async function PUT(request: Request) {
    const newItem = await request.json();

    objects.push(newItem);

    return Response.json(newItem);
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