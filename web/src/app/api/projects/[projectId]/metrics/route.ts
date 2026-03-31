import { getMetricsBundle } from "@/lib/metrics/aggregate";
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
  const raw = url.searchParams.get("range");
  const range: RangeKey = raw === "30d" || raw === "90d" ? raw : "7d";
  const bundle = await getMetricsBundle(projectId, range);
  return Response.json({
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
