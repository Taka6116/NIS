export const maxDuration = 300;

import { runInsightStage4, type InsightProvider } from "@/lib/insights/run-generate";
import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";

function parseProvider(body: unknown): InsightProvider {
  if (!body || typeof body !== "object") return "gemini";
  const p = (body as { provider?: unknown }).provider;
  if (p === "claude") return "claude";
  return "gemini";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ projectId: string; draftId: string }> },
) {
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
  const { projectId, draftId: rawDraftId } = await ctx.params;
  const draftId = decodeURIComponent(rawDraftId);

  let provider: InsightProvider = "gemini";
  try {
    const json = (await req.json()) as unknown;
    provider = parseProvider(json);
  } catch {
    /* empty body */
  }

  try {
    const row = await runInsightStage4(projectId, draftId, provider);
    const encodedInsightId = encodeURIComponent(row.sk);
    const redirectUrl = `/projects/${projectId}/insights/${encodedInsightId}`;
    const actions = row.pipeline?.actions ?? [];
    const hypotheses = row.pipeline?.hypotheses ?? [];
    return Response.json({
      status: "ok",
      insightId: encodedInsightId,
      encodedInsightId,
      insightSk: row.sk,
      redirectUrl,
      actionCount: actions.length,
      hypothesisCount: hypotheses.length,
      hasContentPlan: actions.some((a) => (a.contentPlan?.recommendedActions?.length ?? 0) > 0),
      summary: row.summary,
      provider: row.modelProvider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[finalize/stage4] error:", message, stack);
    return Response.json(
      { error: message, code: e instanceof Error ? e.name : "Error", draftId, detail: stack?.slice(0, 500), status: "failed" },
      { status: 500 },
    );
  }
}
