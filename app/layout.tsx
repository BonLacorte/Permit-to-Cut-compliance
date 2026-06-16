import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grounds Compliance",
  description: "Permit-to-cut document compliance tracking"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
