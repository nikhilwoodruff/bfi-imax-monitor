"use client";

import { useState } from "react";
import Link from "next/link";
import type { PerformanceSummary } from "@/lib/data";

type Screening = Omit<PerformanceSummary, "date"> & { date: string };
type Filter = "all" | "available" | "prime";

export default function ScreeningBrowser({
  screenings,
}: {
  screenings: Screening[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("soonest");
  const films = new Set(screenings.map((s) => s.filmName)).size;
  const available = screenings.reduce((n, s) => n + s.available, 0);
  const prime = screenings.reduce((n, s) => n + s.primeAvailable, 0);
  const latest = screenings.reduce(
    (value, s) => (s.lastScraped > value ? s.lastScraped : value),
    "",
  );
  const filtered = screenings
    .filter(
      (s) =>
        s.filmName.toLowerCase().includes(query.trim().toLowerCase()) &&
        (filter === "all" ||
          (filter === "prime" ? s.primeAvailable > 0 : s.available > 0)),
    )
    .sort((a, b) =>
      sort === "seats"
        ? b.available - a.available
        : a.date.localeCompare(b.date),
    );
  const groups = new Map<string, Screening[]>();
  filtered.forEach((s) =>
    groups.set(s.filmName, [...(groups.get(s.filmName) || []), s]),
  );
  return (
    <div className="screening-browser">
      <div className="page-heading">
        <div>
          <h1>Upcoming screenings</h1>
        </div>
        <a
          className="button button-primary"
          href="https://www.bfi.org.uk/bfi-imax"
          target="_blank"
          rel="noopener noreferrer"
        >
          BFI IMAX website <span aria-hidden="true">↗</span>
        </a>
      </div>
      <section className="stats-grid" aria-label="Availability overview">
        <div className="stat">
          <span>
            Screenings tracked <span aria-hidden="true">▦</span>
          </span>
          <strong>{screenings.length.toLocaleString()}</strong>
          <small>
            Across {films} {films === 1 ? "film" : "films"}
          </small>
        </div>
        <div className="stat">
          <span>
            Seats available <span className="status-dot" />
          </span>
          <strong>{available.toLocaleString()}</strong>
          <small>Across all tracked screenings</small>
        </div>
        <div className="stat">
          <span>
            Prime seats{" "}
            <span className="prime-symbol" aria-hidden="true">
              ✧
            </span>
          </span>
          <strong>{prime.toLocaleString()}</strong>
          <small>Central seats in preferred rows</small>
        </div>
      </section>
      <div className="section-heading">
        <h2>
          Films <span className="count-badge">{films}</span>
        </h2>
        {latest && (
          <span className="updated">
            Last checked{" "}
            {new Date(latest).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            })}{" "}
            UTC
          </span>
        )}
      </div>
      <div className="browser-toolbar">
        <div
          className="filter-tabs"
          role="group"
          aria-label="Filter screenings"
        >
          {(
            [
              ["all", "All screenings"],
              ["available", "Available"],
              ["prime", "Prime seats"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-sort">
          <div className="search-field">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              aria-label="Search films"
              placeholder="Search films…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Sort screenings"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="soonest">Soonest first</option>
            <option value="seats">Most seats</option>
          </select>
        </div>
      </div>
      <div aria-live="polite" className="result-count">
        {filtered.length} {filtered.length === 1 ? "screening" : "screenings"}
        {filter !== "all" || query
          ? " matching your filters"
          : ""}
      </div>
      {groups.size === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">▦</span>
          <h3>
            {screenings.length
              ? "No matching screenings"
              : "No upcoming screenings"}
          </h3>
          <p>
            {screenings.length
              ? "Try another film or adjust your availability filter."
              : "No upcoming screenings are currently tracked."}
          </p>
          {screenings.length > 0 && (
            <button
              className="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        Array.from(groups, ([film, entries], i) => (
          <section className="film-section" key={film}>
            <div className="film-heading">
              <div className="film-number" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <h3>{film}</h3>
                <p>
                  BFI IMAX <span>·</span> {entries.length}{" "}
                  {entries.length === 1 ? "screening" : "screenings"}
                </p>
              </div>
              <span className="format-badge">IMAX</span>
            </div>
            <div className="screening-table">
              <div className="table-head" aria-hidden="true">
                <span>Date & time</span>
                <span>Availability</span>
                <span>Prime seats</span>
                <span />
              </div>
              {entries.map((s) => (
                <Link
                  href={`/screening/${s.id}`}
                  key={s.id}
                  className="screening-row"
                  aria-label={`${film}, ${s.dateStr} at ${s.timeStr}, ${s.available} seats available. View seats`}
                >
                  <div className="screening-date">
                    <span className="calendar-icon" aria-hidden="true">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="3" y="5" width="18" height="16" rx="3" />
                        <path d="M7 3v4m10-4v4M3 11h18" />
                      </svg>
                    </span>
                    <div>
                      <strong>{s.dateStr}</strong>
                      <span>{s.timeStr}</span>
                    </div>
                  </div>
                  <div className="availability-cell">
                    <span
                      className={
                        s.available > 0
                          ? "available-label"
                          : "unavailable-label"
                      }
                    >
                      {s.total === 0
                        ? "Awaiting data"
                        : s.available > 0
                          ? `${s.available} seats available`
                          : "No seats available"}
                    </span>
                    <div className="availability-track">
                      <span
                        style={{
                          width: `${s.total ? Math.min(100, (s.available / s.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="prime-cell">
                    {s.primeAvailable > 0 ? (
                      <span className="prime-badge">
                        ✧ {s.primeAvailable} prime
                      </span>
                    ) : (
                      <span className="no-prime">
                        —<span className="sr-only"> No prime seats</span>
                      </span>
                    )}
                  </div>
                  <span className="row-action">
                    View seats <span aria-hidden="true">↗</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      <div className="info-note">
        <span aria-hidden="true">ⓘ</span>
        <p>
          <strong>Prime seats</strong> Prime seats are central
          positions in the preferred rows, based on the tracker’s seating score.
        </p>
      </div>
    </div>
  );
}
