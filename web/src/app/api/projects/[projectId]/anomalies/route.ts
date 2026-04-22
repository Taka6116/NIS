import { requireSession, isAuthError } from "@/lib/rbac";
import { detectAnomalies } from "@/lib/insights/anomaly";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  try {
    const anomalies = await detectAnomalies(projectId);
    return Response.json({ anomalies });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
