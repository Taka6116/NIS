import { getInsight } from "@/lib/dynamodb/repositories/insights";
import { requireSession, isAuthError } from "@/lib/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; insightId: string }> },
) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId, insightId } = await ctx.params;
  const sk = decodeURIComponent(insightId);
  const insight = await getInsight(projectId, sk);
  if (!insight) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    insight: {
      id: encodeURIComponent(insight.sk),
      ...insight,
    },
  });
}
