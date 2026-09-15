import { StoredObjectSchemaValue } from "./whiteboard/schemas";

export const objects: StoredObjectSchemaValue[] = [
    {
        id: "1",
        shape: "circle",
        strokeColor: "#344b2d",
        fillColor: "#344b2d",
        strokeWidth: 1,
        r: 12,
        x: 100,
        y: 100,
    },
    {
        id: "2",
        shape: "rect",
        strokeColor: "#344b2d",
        fillColor: "#344b2d",
        strokeWidth: 1,
        w: 24,
        h: 24,
        x: 500,
        y: 150,
    },
    {
        id: "3",
        shape: "polygon",
        strokeColor: "#60794a",
        fillColor: "#60794a",
        fillOpacity: 0.5,
        strokeWidth: 2,
        x: 300,
        y: 200,
        points: [
            { x: 300, y: 200 },
            { x: 360, y: 220 },
            { x: 340, y: 280 },
            { x: 280, y: 260 },
        ],
    },
];