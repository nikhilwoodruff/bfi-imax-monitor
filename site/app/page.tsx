import { fetchAllSummaries } from "@/lib/data";
import ScreeningBrowser from "@/components/screening-browser";

export const revalidate = 120;

export default async function Home() {
  const all = await fetchAllSummaries();
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  const screenings = all.filter((s) => s.date >= cutoff);
  return (
    <ScreeningBrowser
      screenings={screenings.map((s) => ({ ...s, date: s.date.toISOString() }))}
    />
  );
}
