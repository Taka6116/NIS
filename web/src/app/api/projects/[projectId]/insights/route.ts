import { listInsights } from "@/lib/dynamodb/repositories/insights";
import { requireSession, isAuthError } from "@/lib/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const insights = await listInsights(projectId, 30);
  return Response.json({
    insights: insights.map((i) => ({
      id: encodeURIComponent(i.sk),
      generatedAt: i.generatedAtIso,
      type: i.type,
      summary: i.summary,
      findings: i.findings,
      topPriority: i.topPriority,
      pipeline: i.pipeline,
      modelProvider: i.modelProvider,
    })),
  });
}
