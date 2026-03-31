import { runInsightGeneration, type InsightProvider } from "@/lib/insights/run-generate";
import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";

function parseProvider(body: unknown): InsightProvider {
  if (!body || typeof body !== "object") return "gemini";
  const p = (body as { provider?: unknown }).provider;
  if (p === "claude") return "claude";
  return "gemini";
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || (meta.role !== "admin" && meta.role !== "member")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
  let provider: InsightProvider = "gemini";
  try {
    const json = (await req.json()) as unknown;
    provider = parseProvider(json);
  } catch {
    /* empty body */
  }
  try {
    const row = await runInsightGeneration(projectId, { provider });
    return Response.json({
      insightId: encodeURIComponent(row.sk),
      status: "ok",
      summary: row.summary,
      provider: row.modelProvider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message, status: "failed" }, { status: 500 });
  }
}
