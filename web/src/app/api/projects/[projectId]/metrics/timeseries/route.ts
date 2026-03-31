import { getTimeseries } from "@/lib/metrics/aggregate";
import { requireSession, isAuthError } from "@/lib/rbac";
import type { RangeKey } from "@/lib/metrics/aggregate";

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
  const raw = url.searchParams.get("range");
  const range: RangeKey = raw === "7d" || raw === "90d" ? raw : "30d";
  const series = await getTimeseries(projectId, metric, range);
  return Response.json(series);
}
