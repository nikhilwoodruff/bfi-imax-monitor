"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { seatScore, type PerformanceSummary } from "@/lib/data";
import SeatMap from "@/components/seat-map";

type Screening = Omit<PerformanceSummary, "date"> & { date: string };
type Filter = "all" | "available" | "prime";

export default function ScreeningBrowser({
  screenings,
}: {
  screenings: Screening[];
}) {
  const [film, setFilm] = useState("");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState<Filter>("available");
  const [sort, setSort] = useState("prime");
  const [expanded, setExpanded] = useState<string | null>(null);
  const films = [...new Set(screenings.map((s) => s.filmName))].sort();
  const latest = screenings.reduce(
    (value, s) => (s.lastScraped > value ? s.lastScraped : value),
    "",
  );
  const filtered = screenings
    .filter(
      (s) =>
        (!film || s.filmName === film) &&
        (!date || s.date.slice(0, 10) === date) &&
        (filter === "all" ||
          (filter === "prime" ? s.primeAvailable > 0 : s.available > 0)),
    )
    .sort(
      (a, b) =>
        (sort === "prime"
          ? b.primeAvailable - a.primeAvailable
          : sort === "seats"
            ? b.available - a.available
            : 0) || a.date.localeCompare(b.date),
    );
  function reset() {
    setFilm("");
    setDate("");
    setFilter("all");
  }
  return (
    <div className="compact-browser">
      <div className="compact-heading">
        <h1>Screenings</h1>
        <span>
          {screenings.length} tracked · {films.length} films
        </span>
        {latest && (
          <span className="compact-updated">
            Checked{" "}
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
      <div className="compact-filters">
        <label>
          Film
          <select value={film} onChange={(e) => setFilm(e.target.value)}>
            <option value="">All films</option>
            {films.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Availability
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="available">Seats available</option>
            <option value="prime">Prime seats available</option>
            <option value="all">All screenings</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="prime">Most prime seats</option>
            <option value="soonest">Soonest</option>
            <option value="seats">Most available seats</option>
          </select>
        </label>
        {(film || date || filter !== "all") && (
          <button className="reset-filters" onClick={reset}>
            Reset
          </button>
        )}
      </div>
      <div className="compact-caption">
        <span aria-live="polite">
          {filtered.length} of {screenings.length} screenings
        </span>
        <span>
          Select a row to see seats. Prime = central seats in preferred rows.
        </span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No matching screenings</h2>
          <button className="button" onClick={reset}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="comparison-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col">Film</th>
                <th scope="col">Date / time</th>
                <th scope="col" className="numeric">
                  Available
                </th>
                <th scope="col" className="numeric">
                  Prime
                </th>
                <th scope="col" className="best-column">
                  Best seats
                </th>
                <th scope="col">
                  <span className="sr-only">Seat details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const best = s.seats
                  .filter(
                    (seat) => seat.status === "available" && !seat.isWheelchair,
                  )
                  .sort(
                    (a, b) =>
                      seatScore(b.row, b.seat) - seatScore(a.row, a.seat),
                  )
                  .slice(0, 3);
                const isOpen = expanded === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr
                      className={
                        isOpen ? "comparison-row open" : "comparison-row"
                      }
                      onClick={() => setExpanded(isOpen ? null : s.id)}
                    >
                      <th scope="row">
                        <button
                          aria-expanded={isOpen}
                          aria-controls={`seats-${s.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(isOpen ? null : s.id);
                          }}
                        >
                          {s.filmName}
                        </button>
                      </th>
                      <td className="date-cell">
                        {s.dateStr}
                        <strong>{s.timeStr}</strong>
                      </td>
                      <td className="numeric">
                        <span
                          className={
                            s.available > 0 ? "seat-count" : "muted-count"
                          }
                        >
                          {s.total ? s.available : "—"}
                        </span>
                      </td>
                      <td className="numeric">
                        <span
                          className={
                            s.primeAvailable ? "prime-count" : "muted-count"
                          }
                        >
                          {s.primeAvailable || "—"}
                        </span>
                      </td>
                      <td className="best-column">
                        {best.length
                          ? best
                              .map((seat) => `${seat.row}${seat.seat}`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="expand-cell" aria-hidden="true">
                        {isOpen ? "−" : "+"}
                      </td>
                    </tr>
                    <tr
                      id={`seats-${s.id}`}
                      hidden={!isOpen}
                      className="inline-details"
                    >
                      <td colSpan={6}>
                        {isOpen && (
                          <div className="inline-seat-panel">
                            <div className="inline-seat-map">
                              {s.seats.length ? (
                                <SeatMap seats={s.seats} />
                              ) : (
                                <p>No seat map data available.</p>
                              )}
                            </div>
                            <div className="inline-seat-summary">
                              <h2>{s.filmName}</h2>
                              <p>
                                {s.dateStr} · {s.timeStr}
                              </p>
                              <dl>
                                <div>
                                  <dt>Available</dt>
                                  <dd>{s.available}</dd>
                                </div>
                                <div>
                                  <dt>Prime seats</dt>
                                  <dd>{s.primeAvailable}</dd>
                                </div>
                                <div>
                                  <dt>Best available</dt>
                                  <dd>
                                    {best.length
                                      ? best
                                          .map(
                                            (seat) => `${seat.row}${seat.seat}`,
                                          )
                                          .join(", ")
                                      : "None"}
                                  </dd>
                                </div>
                              </dl>
                              <p>
                                Seat suggestions are individual seats, not
                                necessarily adjacent.
                              </p>
                              <Link
                                className="button"
                                href={`/screening/${s.id}`}
                              >
                                Full details & history ↗
                              </Link>
                              <button
                                className="close-inline"
                                onClick={() => setExpanded(null)}
                              >
                                Close seat map
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
