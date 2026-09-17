"use client";

import { useState } from "react";
import Sidebar from "@/components/sidebar/sidebar";
import WhiteboardCanvas from "@/components/whiteboard-canvas";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(true);
  const [agentWorking, setAgentWorking] = useState(false);

  return (
    <main
      className={`workspace${chatOpen ? " is-chat-open" : ""}${agentWorking ? " is-working" : ""}`}
    >
      <WhiteboardCanvas agentWorking={agentWorking} chatOpen={chatOpen} />
      <Sidebar
        open={chatOpen}
        onOpenChange={setChatOpen}
        onWorkingChange={setAgentWorking}
      />
    </main>
  );
}
