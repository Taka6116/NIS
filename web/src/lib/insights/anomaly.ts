import { getTimeseriesForDates } from "@/lib/metrics/aggregate";
import { format, parseISO, subDays } from "date-fns";

export type AnomalyPoint = {
  date: string;
  metric: "sessions" | "conversions" | "impressions";
  value: number;
  mean: number;
  stddev: number;
  /** -z 値。大きいほど異常。 */
  zScore: number;
  direction: "up" | "down";
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}
function stddev(xs: number[], mu: number): number {
  return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2)));
}

/**
 * 直近 45 日の日次時系列から、z-score |2.0| を超える点を「異常」として返す。
 * 1 指標あたり最大 5 件。
 */
export async function detectAnomalies(
  projectId: string,
  metrics: Array<"sessions" | "conversions" | "impressions"> = ["sessions", "conversions", "impressions"],
): Promise<AnomalyPoint[]> {
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(parseISO(end), 44), "yyyy-MM-dd");
  const out: AnomalyPoint[] = [];

  for (const m of metrics) {
    const ts = await getTimeseriesForDates(projectId, m, start, end);
    const values = ts.data.map((d) => d.value);
    if (values.length < 7) continue;
    const mu = mean(values);
    const sd = stddev(values, mu) || 1;
    const flagged = ts.data
      .map((d) => ({
        date: d.date,
        metric: m,
        value: d.value,
        mean: mu,
        stddev: sd,
        zScore: (d.value - mu) / sd,
        direction: (d.value >= mu ? "up" : "down") as "up" | "down",
      }))
      .filter((p) => Math.abs(p.zScore) >= 2.0)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 5);
    out.push(...flagged);
  }

  return out;
}
