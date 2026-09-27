// this file contains the functions to take a screenshot of the board

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { objectBounds, unionBounds } from "./geometry";
import { LABEL_BACKGROUND, LABEL_COLOR, labelPlacement } from "./label";
import { StoredObjectSchemaType } from "./schemas";

const PAD = 48;

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type Screen = { sx: number; sy: number };

function shapeSvg(
  obj: StoredObjectSchemaType,
  toScreen: (x: number, y: number) => Screen,
  scale: number,
) {
  const strokeWidth = obj.strokeWidth <= 0 ? 0 : Math.max(obj.strokeWidth * scale, 1.5);
  const fill = `fill="${xml(obj.fillColor)}" fill-opacity="${obj.fillOpacity ?? 1}"`;
  const stroke = `stroke="${xml(obj.strokeColor)}" stroke-width="${strokeWidth}"`;
  let body = "";
  if (obj.object === "circle") {
    const center = toScreen(obj.x, obj.y);
    body = `<circle cx="${center.sx}" cy="${center.sy}" r="${obj.r * scale}" ${fill} ${stroke}/>`;
  } else if (obj.object === "rect" || obj.object === "textbox") {
    const topLeft = toScreen(obj.x, obj.y + obj.h);
    body = `<rect x="${topLeft.sx}" y="${topLeft.sy}" width="${obj.w * scale}" height="${obj.h * scale}" ${fill} ${stroke}/>`;
    if (obj.object === "textbox") {
      body += `<text x="${topLeft.sx + 8}" y="${topLeft.sy + obj.fontSize * scale}" fill="${xml(obj.textColor)}" font-family="Helvetica, Arial, sans-serif" font-size="${obj.fontSize * scale}">${xml(obj.text)}</text>`;
    }
  } else if (obj.object === "polygon") {
    const points = obj.points.map((point) => {
      const screen = toScreen(point.x, point.y);
      return `${screen.sx},${screen.sy}`;
    }).join(" ");
    body = `<polygon points="${points}" ${fill} ${stroke}/>`;
  } else {
    const tail = toScreen(obj.x, obj.y);
    const head = toScreen(obj.x2, obj.y2);
    const len = Math.hypot(head.sx - tail.sx, head.sy - tail.sy) || 1;
    const size = Math.min(18, len * 0.45);
    const angle = Math.atan2(head.sy - tail.sy, head.sx - tail.sx);
    const base = {
      sx: head.sx - size * Math.cos(angle),
      sy: head.sy - size * Math.sin(angle),
    };
    const wing = size * 0.55;
    const left = {
      sx: base.sx + wing * Math.sin(angle),
      sy: base.sy - wing * Math.cos(angle),
    };
    const right = {
      sx: base.sx - wing * Math.sin(angle),
      sy: base.sy + wing * Math.cos(angle),
    };
    body = `<line x1="${tail.sx}" y1="${tail.sy}" x2="${base.sx}" y2="${base.sy}" stroke="${xml(obj.strokeColor)}" stroke-width="${strokeWidth}"/>
      <polygon points="${head.sx},${head.sy} ${left.sx},${left.sy} ${right.sx},${right.sy}" fill="${xml(obj.strokeColor)}"/>`;
  }

  const bounds = objectBounds(obj);
  const center = toScreen((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const text = obj.label?.trim();
  if (text) {
    const place = labelPlacement(obj, text);
    const at = toScreen(place.cx, place.cy);
    const w = place.w * scale;
    const h = place.h * scale;
    body += `<rect x="${at.sx - w / 2}" y="${at.sy - h / 2}" width="${w}" height="${h}" rx="3" fill="${xml(obj.labelBackground || LABEL_BACKGROUND)}" stroke="#e3e5dc"/>
      <text x="${at.sx}" y="${at.sy}" text-anchor="middle" dominant-baseline="central" fill="${xml(obj.labelColor || LABEL_COLOR)}" font-family="Helvetica, Arial, sans-serif" font-size="${place.h * scale}">${xml(text)}</text>`;
  }
  return `<g transform="rotate(${-(obj.rotation ?? 0)} ${center.sx} ${center.sy})">${body}</g>`;
}

export function writeBoardScreenshot(objects: StoredObjectSchemaType[]) {
  const bounds = unionBounds(objects) ?? { minX: 0, minY: 0, maxX: 400, maxY: 260 };
  const worldW = Math.max(bounds.maxX - bounds.minX, 1);
  const worldH = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(1100 / worldW, 760 / worldH);
  const width = Math.ceil(worldW * scale + PAD * 2);
  const height = Math.ceil(worldH * scale + PAD * 2);
  const toScreen = (x: number, y: number) => ({
    sx: (x - bounds.minX) * scale + PAD,
    sy: (bounds.maxY - y) * scale + PAD,
  });
  const shapes = objects.length === 0
    ? `<text x="${PAD}" y="${PAD + 24}" fill="#6f7668" font-family="Helvetica, Arial, sans-serif" font-size="20">The board is empty.</text>`
    : objects.map((obj) => shapeSvg(obj, toScreen, scale)).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f4f3ef"/>
    ${shapes}
  </svg>`;
  const png = new Resvg(svg, {
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica" },
    background: "#f4f3ef",
  }).render().asPng();
  const imagePath = join(tmpdir(), `whiteboard-${crypto.randomUUID()}.png`);
  writeFileSync(imagePath, png);
  return { imagePath, width, height };
}
