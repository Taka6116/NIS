import { getMetricsBundleForDates } from "@/lib/metrics/aggregate";
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
  const metricsWindow = resolveMetricsWindowOrDefault({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
  });
  const bundle = await getMetricsBundleForDates(projectId, metricsWindow.start, metricsWindow.end);
  return Response.json({
    window: { start: metricsWindow.start, end: metricsWindow.end },
    current: {
      sessions: bundle.current.sessions,
      users: bundle.current.users,
      conversions: bundle.current.conversions,
      impressions: bundle.current.impressions,
      clicks: bundle.current.clicks,
      ctr: bundle.current.ctr,
      position: bundle.current.avgPosition,
      bounceRate: bundle.current.bounceRate,
    },
    previous: {
      sessions: bundle.previous.sessions,
      users: bundle.previous.users,
      conversions: bundle.previous.conversions,
      impressions: bundle.previous.impressions,
      clicks: bundle.previous.clicks,
      ctr: bundle.previous.ctr,
      position: bundle.previous.avgPosition,
      bounceRate: bundle.previous.bounceRate,
    },
    change: {
      sessions: bundle.change.sessions,
      users: bundle.change.users,
      conversions: bundle.change.conversions,
      impressions: bundle.change.impressions,
      clicks: bundle.change.clicks,
      ctr: bundle.change.ctr,
      position: bundle.change.avgPosition,
      bounceRate: bundle.change.bounceRate,
    },
    freshnessNote: bundle.freshnessNote,
    clarityUx: bundle.clarityUx,
  });
}
