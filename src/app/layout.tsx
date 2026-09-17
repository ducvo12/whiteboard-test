import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "A simple whiteboard canvas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.className}>
      <body>{children}</body>
    </html>
  );
}
