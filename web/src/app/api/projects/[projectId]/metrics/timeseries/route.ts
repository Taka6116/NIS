import { getTimeseriesForDates } from "@/lib/metrics/aggregate";
import { resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import { requireSession, isAuthError } from "@/lib/rbac";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const url = new URL(req.url);
  const metric = (url.searchParams.get("metric") ?? "sessions") as
    | "sessions"
    | "conversions"
    | "impressions"
    | "avgPosition";
  const metricsWindow = resolveMetricsWindowOrDefault({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
  });
  const series = await getTimeseriesForDates(projectId, metric, metricsWindow.start, metricsWindow.end);
  return Response.json(series);
}
