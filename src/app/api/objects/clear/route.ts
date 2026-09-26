import { clearObjects } from "@/lib/whiteboard/services";

export async function POST() {
    return Response.json(clearObjects());
}
