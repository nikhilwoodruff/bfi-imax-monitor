import type { Metadata } from "next";
import "./globals.css";
import PasswordGate from "@/components/password-gate";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "BFI IMAX monitor",
  description: "Seat availability tracker for BFI IMAX screenings",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PasswordGate>
          <AppShell>{children}</AppShell>
        </PasswordGate>
      </body>
    </html>
  );
}
