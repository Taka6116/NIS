import { runInsightGeneration } from "@/lib/insights/run-generate";
import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";

export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
  try {
    const row = await runInsightGeneration(projectId);
    return Response.json({
      insightId: encodeURIComponent(row.sk),
      status: "ok",
      summary: row.summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message, status: "failed" }, { status: 500 });
  }
}
