import type { Metadata } from "next";
import "./globals.css";
import PasswordGate from "@/components/password-gate";

export const metadata: Metadata = {
  title: "BFI IMAX monitor",
  description: "Live seat availability tracker for BFI IMAX screenings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PasswordGate>
          <div className="min-h-screen">
            <header
              className="border-b px-6 py-4 flex items-center justify-between"
              style={{ borderColor: "var(--border)", background: "var(--bg-deep)" }}
            >
              <a href="/" className="flex items-center gap-3 no-underline">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dim))",
                    color: "var(--bg-deep)",
                  }}
                >
                  BFI
                </div>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    IMAX monitor
                  </span>
                </div>
              </a>
              <a
                href="https://github.com/nikhilwoodruff/bfi-imax-monitor"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs no-underline"
                style={{ color: "var(--text-muted)" }}
              >
                github
              </a>
            </header>
            <main className="max-w-5xl mx-auto px-4 py-8">
              {children}
            </main>
          </div>
        </PasswordGate>
      </body>
    </html>
  );
}
