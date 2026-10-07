"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/sidebar/sidebar";

const TldrawBoard = dynamic(() => import("@/components/tldraw-board"), {
  ssr: false,
  loading: () => <p className="board-loading" role="status">Loading whiteboard…</p>,
});

export default function Home() {
  const [chatOpen, setChatOpen] = useState(true);
  const [agentWorking, setAgentWorking] = useState(false);

  return (
    <main
      className={`workspace${chatOpen ? " is-chat-open" : ""}${agentWorking ? " is-working" : ""}`}
    >
      <section className="tldraw-board" aria-label="Whiteboard">
        <TldrawBoard />
      </section>
      <Sidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        onWorkingChange={setAgentWorking}
      />
    </main>
  );
}
