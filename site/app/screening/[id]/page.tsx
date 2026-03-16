import { fetchIndex, fetchSeats, getLatestSnapshot, getAvailabilityTimeline, isPrimeSeat, seatScore, ROW_ORDER, seatsInRow } from "@/lib/data";
import Link from "next/link";
import SeatMap from "@/components/seat-map";
import AvailabilityChart from "@/components/availability-chart";

export const revalidate = 120;

interface Props {
  params: Promise<{ id: string }>;
}

function parseLabel(label: string) {
  const commaIdx = label.lastIndexOf(",");
  if (commaIdx <= 0) return { filmName: label, dateTime: "" };
  return {
    filmName: label.slice(0, commaIdx).trim(),
    dateTime: label.slice(commaIdx + 1).trim(),
  };
}

export default async function ScreeningPage({ params }: Props) {
  const { id } = await params;
  const index = await fetchIndex();
  const meta = index[id];

  if (!meta) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--text-muted)" }}>Screening not found.</p>
        <Link href="/" className="text-sm mt-4 inline-block" style={{ color: "var(--accent-gold)" }}>
          Back to all screenings
        </Link>
      </div>
    );
  }

  const seatRows = await fetchSeats(id);
  const seats = getLatestSnapshot(seatRows);
  const timeline = getAvailabilityTimeline(seatRows);

  const { filmName, dateTime } = parseLabel(meta.label);
  const available = seats.filter((s) => s.status === "available");
  const sold = seats.filter((s) => s.status === "sold");
  const primeAvailable = available.filter((s) => isPrimeSeat(s.row, s.seat));

  // Best available seats (by score)
  const bestSeats = available
    .filter((s) => !s.isWheelchair)
    .map((s) => ({ ...s, score: seatScore(s.row, s.seat) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Per-row breakdown
  const rowBreakdown = ROW_ORDER.map((row) => {
    const total = seatsInRow(row);
    const rowSeats = seats.filter((s) => s.row === row);
    const avail = rowSeats.filter((s) => s.status === "available").length;
    const soldCount = rowSeats.filter((s) => s.status === "sold").length;
    return { row, total, available: avail, sold: soldCount };
  });

  return (
    <div>
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs no-underline mb-6"
        style={{ color: "var(--text-muted)" }}
      >
        &larr; all screenings
      </Link>

      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {filmName}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {dateTime}
        </p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 animate-fade-up stagger-1">
        <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent-green)", fontFamily: "'JetBrains Mono', monospace" }}>
            {available.length}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>available</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent-red)", fontFamily: "'JetBrains Mono', monospace" }}>
            {sold.length}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>sold</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: primeAvailable.length > 0 ? "var(--accent-gold-dim)" : "var(--border)" }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent-gold)", fontFamily: "'JetBrains Mono', monospace" }}>
            {primeAvailable.length}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>prime seats</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
            {seats.length > 0 ? Math.round((sold.length / seats.length) * 100) : 0}%
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>sold out</p>
        </div>
      </div>

      {/* Seat map */}
      <div
        className="rounded-lg p-6 border mb-8 animate-fade-up stagger-2"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
          Seat map
        </h2>
        <SeatMap seats={seats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best available seats */}
        <div
          className="rounded-lg p-6 border animate-fade-up stagger-3"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
            Best available seats
          </h2>
          {bestSeats.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No seats available.</p>
          ) : (
            <div className="space-y-1.5">
              {bestSeats.map((s, i) => (
                <div
                  key={`${s.row}-${s.seat}`}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: i === 0 ? "rgba(212, 168, 83, 0.08)" : "transparent" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold tabular-nums w-10"
                      style={{ color: isPrimeSeat(s.row, s.seat) ? "var(--accent-gold)" : "var(--accent-green)", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {s.row}{s.seat}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      row {s.row}, seat {s.seat}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPrimeSeat(s.row, s.seat) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(212, 168, 83, 0.15)", color: "var(--accent-gold)" }}>
                        prime
                      </span>
                    )}
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {(s.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Row breakdown */}
        <div
          className="rounded-lg p-6 border animate-fade-up stagger-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
            By row
          </h2>
          <div className="space-y-1">
            {rowBreakdown.map((r) => {
              const pctSold = r.total > 0 ? (r.sold / r.total) * 100 : 0;
              return (
                <div key={r.row} className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold w-4 text-center"
                    style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {r.row}
                  </span>
                  <div className="flex-1 h-3 rounded overflow-hidden flex" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full"
                      style={{ width: `${pctSold}%`, background: "var(--accent-red)", opacity: 0.7 }}
                    />
                    <div
                      className="h-full"
                      style={{ width: `${r.total > 0 ? (r.available / r.total) * 100 : 0}%`, background: "var(--accent-green)", opacity: 0.7 }}
                    />
                  </div>
                  <span
                    className="text-[10px] tabular-nums w-8 text-right"
                    style={{ color: r.available > 0 ? "var(--accent-green)" : "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {r.available}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline chart */}
      <div
        className="rounded-lg p-6 border mt-6 animate-fade-up stagger-5"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
          Availability over time
        </h2>
        <AvailabilityChart data={timeline} />
      </div>

      {/* Metadata */}
      <div className="mt-6 text-[11px] tabular-nums" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
        <p>first scraped: {meta.first_scraped}</p>
        <p>last scraped: {meta.last_scraped}</p>
        <p>snapshots: {timeline.length}</p>
      </div>
    </div>
  );
}
