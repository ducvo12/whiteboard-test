"use client";

import Sidebar from "@/components/sidebar";

export default function Home() {
  return (
    <main className="workspace">

      <section className="canvas" aria-label="Blank whiteboard canvas" />

      <Sidebar></Sidebar>

    </main>
  );
}
