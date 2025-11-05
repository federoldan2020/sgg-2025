import "@/app/globals.css";
import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "PGG 2025",
  description: "Sistema interno de gestión gremial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
