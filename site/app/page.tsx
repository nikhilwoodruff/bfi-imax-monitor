import { fetchAllSummaries, PerformanceSummary } from "@/lib/data";
import Link from "next/link";

export const revalidate = 120;

function groupByFilm(summaries: PerformanceSummary[]) {
  const groups = new Map<string, PerformanceSummary[]>();
  for (const s of summaries) {
    const key = s.filmName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return groups;
}

function AvailabilityBar({ available, sold, total }: { available: number; sold: number; total: number }) {
  const pctAvailable = total > 0 ? (available / total) * 100 : 0;
  const pctSold = total > 0 ? (sold / total) * 100 : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "var(--border)" }}>
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${pctSold}%`, background: "var(--accent-red)" }}
      />
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${pctAvailable}%`, background: "var(--accent-green)" }}
      />
    </div>
  );
}

function ScreeningCard({ perf }: { perf: PerformanceSummary }) {
  const pctSold = perf.total > 0 ? Math.round((perf.sold / perf.total) * 100) : 0;
  const hasPrime = perf.primeAvailable > 0;

  return (
    <Link
      href={`/screening/${perf.id}`}
      className="block no-underline"
    >
      <div
        className="rounded-lg p-4 transition-all duration-200 border hover:brightness-110"
        style={{
          background: "var(--bg-card)",
          borderColor: hasPrime ? "var(--accent-gold-dim)" : "var(--border)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {perf.dateStr}
            </p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {perf.timeStr}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: perf.available > 0 ? "var(--accent-green)" : "var(--accent-red)", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {perf.available}
            </p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              available
            </p>
          </div>
        </div>

        <AvailabilityBar available={perf.available} sold={perf.sold} total={perf.total} />

        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            {pctSold}% sold
          </p>
          {hasPrime && (
            <p className="text-[11px] font-medium" style={{ color: "var(--accent-gold)" }}>
              {perf.primeAvailable} prime seats
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function Home() {
  const summaries = await fetchAllSummaries();
  const groups = groupByFilm(summaries);

  const totalAvailable = summaries.reduce((n, s) => n + s.available, 0);
  const totalPrime = summaries.reduce((n, s) => n + s.primeAvailable, 0);
  const lastScraped = summaries.length > 0
    ? summaries.reduce((latest, s) => s.lastScraped > latest ? s.lastScraped : latest, summaries[0].lastScraped)
    : null;

  return (
    <div>
      {/* Hero stats */}
      <div className="mb-10 animate-fade-up">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Upcoming screenings
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {summaries.length} showings across {groups.size} films
            </p>
          </div>
          {lastScraped && (
            <p className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
              updated {new Date(lastScraped).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
              {summaries.length}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>screenings tracked</p>
          </div>
          <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--accent-green)", fontFamily: "'JetBrains Mono', monospace" }}>
              {totalAvailable.toLocaleString()}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>total seats available</p>
          </div>
          <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <p className="text-3xl font-bold tabular-nums" style={{ color: "var(--accent-gold)", fontFamily: "'JetBrains Mono', monospace" }}>
              {totalPrime.toLocaleString()}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>prime seats available</p>
          </div>
        </div>
      </div>

      {/* Film groups */}
      {Array.from(groups.entries()).map(([filmName, perfs], groupIdx) => (
        <div
          key={filmName}
          className={`mb-10 animate-fade-up stagger-${Math.min(groupIdx + 1, 6)}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {filmName}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--border)", color: "var(--text-secondary)" }}>
              {perfs.length} showing{perfs.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perfs.map((perf) => (
              <ScreeningCard key={perf.id} perf={perf} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
