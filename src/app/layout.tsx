import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Solutions Utilization Dashboard",
  description:
    "Executive utilization & billing dashboard with monthly Excel ingestion, configuration-driven business rules and self-contained executive snapshots",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
