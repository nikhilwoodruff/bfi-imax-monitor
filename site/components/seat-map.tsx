"use client";

import { Seat, ROW_ORDER, seatsInRow, maxSeatsInAnyRow, isPrimeSeat, seatScore } from "@/lib/data";
import { useState } from "react";

interface SeatMapProps {
  seats: Seat[];
  compact?: boolean;
}

export default function SeatMap({ seats, compact = false }: SeatMapProps) {
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const maxSeats = maxSeatsInAnyRow();

  // Build a lookup: row-seat -> Seat
  const lookup = new Map<string, Seat>();
  for (const s of seats) {
    lookup.set(`${s.row}-${s.seat}`, s);
  }

  const seatSize = compact ? 6 : 10;
  const gap = compact ? 1 : 2;
  const rowLabelWidth = compact ? 14 : 20;
  const svgWidth = rowLabelWidth + maxSeats * (seatSize + gap) + 20;
  const svgHeight = ROW_ORDER.length * (seatSize + gap + (compact ? 1 : 2)) + 40;

  return (
    <div className="relative">
      {/* Screen indicator */}
      <div className="flex justify-center mb-3">
        <div
          className="h-[2px] rounded-full"
          style={{
            width: compact ? "60%" : "70%",
            background: "linear-gradient(90deg, transparent, var(--accent-gold-dim), var(--accent-gold), var(--accent-gold-dim), transparent)",
          }}
        />
      </div>
      <p
        className="text-center mb-3 tracking-[0.3em] uppercase"
        style={{
          color: "var(--text-muted)",
          fontSize: compact ? "8px" : "10px",
        }}
      >
        screen
      </p>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="mx-auto"
          style={{ maxWidth: compact ? "100%" : "800px", width: "100%" }}
        >
          {ROW_ORDER.map((row, rowIdx) => {
            const count = seatsInRow(row);
            const offset = (maxSeats - count) / 2 * (seatSize + gap);
            const y = rowIdx * (seatSize + gap + (compact ? 1 : 2)) + 4;

            return (
              <g key={row}>
                {/* Row label */}
                <text
                  x={compact ? 6 : 8}
                  y={y + seatSize / 2 + 1}
                  fill="var(--text-muted)"
                  fontSize={compact ? 5 : 8}
                  fontFamily="'JetBrains Mono', monospace"
                  dominantBaseline="middle"
                  textAnchor="middle"
                >
                  {row}
                </text>

                {/* Seats */}
                {Array.from({ length: count }, (_, seatIdx) => {
                  const seatNum = seatIdx + 1;
                  const seat = lookup.get(`${row}-${seatNum}`);
                  const x = rowLabelWidth + offset + seatIdx * (seatSize + gap);
                  const prime = isPrimeSeat(row, seatNum);
                  const status = seat?.status || "unavailable";
                  const wheelchair = seat?.isWheelchair || false;

                  let fill = "var(--seat-unavailable)";
                  if (status === "available" && prime) fill = "var(--seat-prime)";
                  else if (status === "available") fill = "var(--seat-available)";
                  else if (status === "sold") fill = "var(--seat-sold)";

                  let opacity = 1;
                  if (status === "unavailable") opacity = 0.4;
                  if (wheelchair && status !== "available") opacity = 0.3;

                  return (
                    <rect
                      key={`${row}-${seatNum}`}
                      x={x}
                      y={y}
                      width={seatSize}
                      height={seatSize}
                      rx={compact ? 1 : 1.5}
                      fill={fill}
                      opacity={opacity}
                      className="transition-opacity duration-150"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => seat && setHoveredSeat(seat)}
                      onMouseLeave={() => setHoveredSeat(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredSeat && !compact && (
        <div
          className="absolute top-2 right-2 px-3 py-2 rounded-lg text-xs animate-fade-in"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>
            {hoveredSeat.row}{hoveredSeat.seat}
          </span>
          <span style={{ color: "var(--text-muted)" }}> &middot; </span>
          <span
            style={{
              color:
                hoveredSeat.status === "available"
                  ? isPrimeSeat(hoveredSeat.row, hoveredSeat.seat)
                    ? "var(--accent-gold)"
                    : "var(--accent-green)"
                  : hoveredSeat.status === "sold"
                  ? "var(--accent-red)"
                  : "var(--text-muted)",
            }}
          >
            {hoveredSeat.status}
          </span>
          {hoveredSeat.isWheelchair && (
            <span style={{ color: "var(--text-muted)" }}> (wheelchair)</span>
          )}
          {isPrimeSeat(hoveredSeat.row, hoveredSeat.seat) && hoveredSeat.status === "available" && (
            <>
              <br />
              <span style={{ color: "var(--accent-gold)" }}>
                score: {(seatScore(hoveredSeat.row, hoveredSeat.seat) * 100).toFixed(0)}%
              </span>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="flex justify-center gap-5 mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--seat-prime)" }} />
            prime
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--seat-available)" }} />
            available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--seat-sold)" }} />
            sold
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--seat-unavailable)", opacity: 0.4 }} />
            n/a
          </span>
        </div>
      )}
    </div>
  );
}
