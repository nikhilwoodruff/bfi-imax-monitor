"use client";

interface DataPoint {
  time: string;
  available: number;
  sold: number;
  prime: number;
}

export default function AvailabilityChart({ data }: { data: DataPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
        Need more scrape snapshots to show a timeline.
      </p>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.available, d.sold)));
  const chartH = 120;
  const chartW = 500;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  function toX(i: number) {
    return padL + (i / (data.length - 1)) * plotW;
  }
  function toY(v: number) {
    return padT + plotH - (v / maxVal) * plotH;
  }

  function makePath(key: keyof DataPoint) {
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d[key] as number).toFixed(1)}`)
      .join(" ");
  }

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: 600 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <g key={pct}>
          <line
            x1={padL}
            x2={chartW - padR}
            y1={padT + plotH * (1 - pct)}
            y2={padT + plotH * (1 - pct)}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
          <text
            x={padL - 4}
            y={padT + plotH * (1 - pct)}
            fill="var(--text-muted)"
            fontSize={7}
            fontFamily="'JetBrains Mono', monospace"
            textAnchor="end"
            dominantBaseline="middle"
          >
            {Math.round(maxVal * pct)}
          </text>
        </g>
      ))}

      {/* Sold area */}
      <path
        d={`${makePath("sold")} L ${toX(data.length - 1)} ${padT + plotH} L ${toX(0)} ${padT + plotH} Z`}
        fill="var(--accent-red)"
        opacity={0.08}
      />
      {/* Available area */}
      <path
        d={`${makePath("available")} L ${toX(data.length - 1)} ${padT + plotH} L ${toX(0)} ${padT + plotH} Z`}
        fill="var(--accent-green)"
        opacity={0.08}
      />

      {/* Lines */}
      <path d={makePath("sold")} fill="none" stroke="var(--accent-red)" strokeWidth={1.5} />
      <path d={makePath("available")} fill="none" stroke="var(--accent-green)" strokeWidth={1.5} />
      <path d={makePath("prime")} fill="none" stroke="var(--accent-gold)" strokeWidth={1.5} strokeDasharray="3 2" />

      {/* Time labels */}
      {data.length <= 12
        ? data.map((d, i) => (
            <text
              key={i}
              x={toX(i)}
              y={chartH - 4}
              fill="var(--text-muted)"
              fontSize={6}
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {new Date(d.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </text>
          ))
        : [0, Math.floor(data.length / 2), data.length - 1].map((i) => (
            <text
              key={i}
              x={toX(i)}
              y={chartH - 4}
              fill="var(--text-muted)"
              fontSize={6}
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {new Date(data[i].time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </text>
          ))}

      {/* Legend */}
      <circle cx={padL + 4} cy={padT - 1} r={2.5} fill="var(--accent-green)" />
      <text x={padL + 10} y={padT} fill="var(--text-secondary)" fontSize={7} fontFamily="'JetBrains Mono', monospace">
        available
      </text>
      <circle cx={padL + 62} cy={padT - 1} r={2.5} fill="var(--accent-red)" />
      <text x={padL + 68} y={padT} fill="var(--text-secondary)" fontSize={7} fontFamily="'JetBrains Mono', monospace">
        sold
      </text>
      <circle cx={padL + 100} cy={padT - 1} r={2.5} fill="var(--accent-gold)" />
      <text x={padL + 106} y={padT} fill="var(--text-secondary)" fontSize={7} fontFamily="'JetBrains Mono', monospace">
        prime
      </text>
    </svg>
  );
}
