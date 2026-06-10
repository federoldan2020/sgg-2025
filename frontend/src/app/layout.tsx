import "@/app/globals.css";
import type { Metadata } from "next";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider } from "@/contexts/auth";
import { OrgSelectorProvider } from "@/contexts/orgSelector";
import { Toaster } from "@/components/ui/sonner"; // Added Toaster import
import UppercaseInputs from "@/components/UppercaseInputs";

export const metadata: Metadata = {
  title: "PGG 2025",
  description: "Sistema interno de gestión gremial",
};

export default function RootLayout({
  children,
}: Readonly<{ // Changed to Readonly
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <UppercaseInputs />
        <AuthProvider>
          <OrgSelectorProvider>
            <AppLayout>{children}</AppLayout>
          </OrgSelectorProvider>
        </AuthProvider>
        <Toaster position="top-right" expand richColors closeButton />
      </body>
    </html>
  );
}
