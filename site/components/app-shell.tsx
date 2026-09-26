"use client";
import Link from "next/link";
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="compact-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="compact-topbar">
        <Link href="/" className="brand">
          <span className="brand-mark">bfi</span>IMAX monitor
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Screenings</Link>
          <a
            href="https://www.bfi.org.uk/bfi-imax"
            target="_blank"
            rel="noopener noreferrer"
          >
            BFI website ↗
          </a>
        </nav>
      </header>
      <main id="main-content" className="main-content">
        {children}
      </main>
      <footer className="page-footer">
        Independent tracker. Availability may change before booking.
      </footer>
    </div>
  );
}
