"use client";

import Sidebar from "@/components/sidebar/sidebar";
import WhiteboardCanvas from "@/components/whiteboard-canvas";

export default function Home() {
  return (
    <main className="workspace">
      <WhiteboardCanvas />
      <Sidebar />
    </main>
  );
}
