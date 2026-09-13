import { objects } from "@/lib/object-data";

export async function GET() {
    return Response.json(objects);
}