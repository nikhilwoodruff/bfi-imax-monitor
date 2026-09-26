"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">bfi</span>
          <span>
            IMAX monitor
            <span className="brand-caption">Your cinema, at a glance</span>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            href="/"
            className="nav-item active"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <span aria-hidden="true">▦</span> Screenings{" "}
            <span className="nav-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">A BETTER VIEW</span>
          <p>Find your next big-screen moment.</p>
          <span>Explore availability and find the best seats at BFI IMAX.</span>
        </div>
        <div className="sidebar-bottom">
          <a
            href="https://www.bfi.org.uk/bfi-imax"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit BFI IMAX <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/nikhilwoodruff/bfi-imax-monitor"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub <span aria-hidden="true">↗</span>
          </a>
          <div className="workspace-footer">
            <span className="venue-avatar">B</span>
            <span>
              BFI IMAX<span className="brand-caption">London · Waterloo</span>
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>{pathname === "/" ? "Screenings" : "Screening details"}</span>
          </div>
          <span className="topbar-caption">Seat availability tracker</span>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="page-footer">
          Independent tracker. Availability may change before booking.
          <span>Made for the big screen.</span>
        </footer>
      </div>
    </div>
  );
}
