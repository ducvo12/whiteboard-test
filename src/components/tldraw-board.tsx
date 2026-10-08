"use client";

import { Tldraw } from "tldraw";
import { useCallback, useState } from "react";
import type { Editor } from "tldraw";
import { connectBoard } from "@/lib/whiteboard/tldraw-sync";
import { ExactBoardShapeUtil } from "./shapes/exact-board-shape";
import { BoardControls, BoardStylePanel } from "./board-controls";

const shapeUtils = [ExactBoardShapeUtil];
const components = { InFrontOfTheCanvas: BoardControls, StylePanel: BoardStylePanel };
const overrides = { translations: { en: { "tool.board-object": "Board shape" } } };

export default function TldrawBoard() {
  const [notice, setNotice] = useState("");
  const onMount = useCallback((editor: Editor) => connectBoard(editor, setNotice), []);
  return <>
    <Tldraw onMount={onMount} shapeUtils={shapeUtils} components={components} overrides={overrides} options={{ maxPages: 1 }} licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} />
    {notice && <p className="board-sync-notice" role="status">{notice}</p>}
  </>;
}
