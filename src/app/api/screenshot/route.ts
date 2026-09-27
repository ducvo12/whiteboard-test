import { readFileSync } from "node:fs";
import { writeBoardScreenshot } from "@/lib/whiteboard/screenshot";
import { listObjects } from "@/lib/whiteboard/services";

// Temporary. Open /api/screenshot to view the current board as a PNG.
export async function GET() {
    const shot = writeBoardScreenshot(listObjects({}));
    console.log(shot.imagePath);
    const png = readFileSync(shot.imagePath);
    return new Response(png, {
        headers: {
            "Content-Type": "image/png",
            "X-Image-Path": shot.imagePath,
        },
    });
}
