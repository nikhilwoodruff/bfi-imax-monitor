import Papa from "papaparse";

const REPO = "nikhilwoodruff/bfi-imax-monitor";
const BRANCH = "main";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

export interface PerformanceIndex {
  [id: string]: {
    film_slug: string;
    label: string;
    first_scraped: string;
    last_scraped: string;
  };
}

export interface SeatRow {
  scraped_at: string;
  row: string;
  seat: number;
  status: string;
  is_wheelchair: string;
  description: string;
}

export interface Seat {
  row: string;
  seat: number;
  status: string;
  isWheelchair: boolean;
  description: string;
}

export interface PerformanceSummary {
  id: string;
  filmSlug: string;
  label: string;
  filmName: string;
  dateStr: string;
  timeStr: string;
  date: Date;
  lastScraped: string;
  available: number;
  sold: number;
  total: number;
  primeAvailable: number;
}

// BFI IMAX layout: rows A-Q (no I), seats vary per row
// A=13, B-C=36, D-E=37, F=38, G-H=37, J=36, K=36, L=33, M-N=34, P=31, Q=18
const SEATS_PER_ROW: Record<string, number> = {
  A: 13, B: 36, C: 36, D: 37, E: 37, F: 38,
  G: 37, H: 37, J: 36, K: 36, L: 33, M: 34,
  N: 34, P: 31, Q: 18,
};

export const ROW_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q"];
export const TOTAL_ROWS = ROW_ORDER.length;

export function seatsInRow(row: string): number {
  return SEATS_PER_ROW[row] || 0;
}

export function maxSeatsInAnyRow(): number {
  return Math.max(...Object.values(SEATS_PER_ROW));
}

// "Prime" seats: centre of rows G-N (roughly the back half, not too close)
// Centre = middle third of each row
export function isPrimeSeat(row: string, seat: number): boolean {
  const rowIdx = ROW_ORDER.indexOf(row);
  if (rowIdx < 0) return false;
  // Rows F through N (indices 5-13) are "good" rows — far enough back
  if (rowIdx < 5 || rowIdx > 13) return false;
  const total = seatsInRow(row);
  const third = total / 3;
  return seat > third && seat <= third * 2;
}

export function seatScore(row: string, seat: number): number {
  const rowIdx = ROW_ORDER.indexOf(row);
  if (rowIdx < 0) return 0;
  // Row position: prefer ~60-75% back (rows G-L, indices 6-10)
  const idealRowPct = 0.67;
  const rowPct = rowIdx / (TOTAL_ROWS - 1);
  const rowScore = 1 - Math.abs(rowPct - idealRowPct) / idealRowPct;
  // Centrality: prefer middle
  const total = seatsInRow(row);
  const centre = (total + 1) / 2;
  const centrality = 1 - Math.abs(seat - centre) / centre;
  return rowScore * 0.6 + centrality * 0.4;
}

function parseLabel(label: string): { filmName: string; dateStr: string; timeStr: string; date: Date } {
  // Label format: "Film Name, DayOfWeek DD Month YYYY HH:MM"
  // or "Preview: Film Name, DayOfWeek DD Month YYYY HH:MM"
  const commaIdx = label.lastIndexOf(",");
  let filmName = label;
  let dateStr = "";
  let timeStr = "";
  let date = new Date();

  if (commaIdx > 0) {
    filmName = label.slice(0, commaIdx).trim();
    const datePart = label.slice(commaIdx + 1).trim();
    // Parse "Monday 16 March 2026 15:15"
    const match = datePart.match(/(\w+)\s+(\d+)\s+(\w+)\s+(\d+)\s+(\d+:\d+)/);
    if (match) {
      const [, dayName, day, month, year, time] = match;
      dateStr = `${dayName.slice(0, 3)} ${day} ${month.slice(0, 3)}`;
      timeStr = time;
      date = new Date(`${day} ${month} ${year} ${time}`);
    }
  }

  // Clean up film name - remove "- " prefix from older labels
  if (filmName.startsWith("- ")) filmName = filmName.slice(2);

  return { filmName, dateStr, timeStr, date };
}

export async function fetchIndex(): Promise<PerformanceIndex> {
  const res = await fetch(`${RAW}/data/index.json`, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`Failed to fetch index: ${res.status}`);
  return res.json();
}

export async function fetchSeats(performanceId: string): Promise<SeatRow[]> {
  const res = await fetch(`${RAW}/data/${performanceId}.csv`, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`Failed to fetch seats: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<SeatRow>(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

export function getLatestSnapshot(rows: SeatRow[]): Seat[] {
  if (rows.length === 0) return [];
  // Find the latest scraped_at timestamp
  const latest = rows.reduce((max, r) => r.scraped_at > max ? r.scraped_at : max, rows[0].scraped_at);
  return rows
    .filter((r) => r.scraped_at === latest)
    .map((r) => ({
      row: r.row,
      seat: Number(r.seat),
      status: r.status,
      isWheelchair: r.is_wheelchair === "True",
      description: r.description,
    }));
}

export function getAvailabilityTimeline(rows: SeatRow[]): { time: string; available: number; sold: number; prime: number }[] {
  const byTime = new Map<string, { available: number; sold: number; prime: number }>();
  for (const r of rows) {
    if (!byTime.has(r.scraped_at)) {
      byTime.set(r.scraped_at, { available: 0, sold: 0, prime: 0 });
    }
    const entry = byTime.get(r.scraped_at)!;
    if (r.status === "available") {
      entry.available++;
      if (isPrimeSeat(r.row, Number(r.seat))) {
        entry.prime++;
      }
    } else if (r.status === "sold") {
      entry.sold++;
    }
  }
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, data]) => ({ time, ...data }));
}

export async function fetchAllSummaries(): Promise<PerformanceSummary[]> {
  const index = await fetchIndex();
  const summaries: PerformanceSummary[] = [];

  const entries = Object.entries(index);
  // Fetch all CSVs in parallel
  const results = await Promise.allSettled(
    entries.map(async ([id, meta]) => {
      const seatRows = await fetchSeats(id);
      const seats = getLatestSnapshot(seatRows);
      const { filmName, dateStr, timeStr, date } = parseLabel(meta.label);
      const available = seats.filter((s) => s.status === "available").length;
      const sold = seats.filter((s) => s.status === "sold").length;
      const primeAvailable = seats.filter(
        (s) => s.status === "available" && isPrimeSeat(s.row, s.seat)
      ).length;

      return {
        id,
        filmSlug: meta.film_slug,
        label: meta.label,
        filmName,
        dateStr,
        timeStr,
        date,
        lastScraped: meta.last_scraped,
        available,
        sold,
        total: seats.length,
        primeAvailable,
      } satisfies PerformanceSummary;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") summaries.push(r.value);
  }

  return summaries.sort((a, b) => a.date.getTime() - b.date.getTime());
}
