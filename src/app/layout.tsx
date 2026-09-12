import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whiteboard",
  description: "A simple whiteboard canvas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="m-0 overflow-hidden">{children}</body>
    </html>
  );
}
