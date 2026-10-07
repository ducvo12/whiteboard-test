"use client";

import { Tldraw } from "tldraw";
import { useCallback, useState } from "react";
import type { Editor } from "tldraw";
import { connectBoard } from "@/lib/whiteboard/tldraw-sync";

export default function TldrawBoard() {
  const [notice, setNotice] = useState("");
  const onMount = useCallback((editor: Editor) => connectBoard(editor, setNotice), []);
  return <>
    <Tldraw onMount={onMount} options={{ maxPages: 1 }} licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY} />
    {notice && <p className="board-sync-notice" role="status">{notice}</p>}
  </>;
}
