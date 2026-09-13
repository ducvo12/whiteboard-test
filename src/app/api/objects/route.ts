import { objects } from "@/lib/object-data";

export async function GET() {
    return Response.json(objects);
}

export async function POST(request: Request) {
    const newItem = await request.json();

    objects.push(newItem);

    return Response.json(newItem);
}

export async function DELETE(request: Request) {
    const { id } = await request.json();

    const index = objects.findIndex(object => object.id === id);

    if (index !== -1) {
        objects.splice(index, 1);
    }

    return Response.json({ success: true });
}