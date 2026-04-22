import { runInsightDraft, type InsightProvider, type InsightWindowInput } from "@/lib/insights/run-generate";
import { resolveMetricsWindow } from "@/lib/metrics/date-range";
import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";

function parseProvider(body: unknown): InsightProvider {
  if (!body || typeof body !== "object") return "gemini";
  const p = (body as { provider?: unknown }).provider;
  if (p === "claude") return "claude";
  return "gemini";
}

function parseWindow(body: unknown): InsightWindowInput | undefined {
  if (!body || typeof body !== "object") return undefined;
  const w = (body as { window?: unknown }).window;
  if (!w || typeof w !== "object") return undefined;
  const raw = w as Record<string, unknown>;
  return {
    from: typeof raw.from === "string" ? raw.from : undefined,
    to: typeof raw.to === "string" ? raw.to : undefined,
    range: typeof raw.preset === "string" ? raw.preset : typeof raw.range === "string" ? raw.range : undefined,
    comparison: raw.comparison === "yoy" ? "yoy" : "previous",
  };
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
  let windowInput: InsightWindowInput | undefined;
  try {
    const json = (await req.json()) as unknown;
    provider = parseProvider(json);
    windowInput = parseWindow(json);
  } catch {
    /* empty body */
  }

  const wr = resolveMetricsWindow({
    from: windowInput?.from,
    to: windowInput?.to,
    range: windowInput?.range ?? "28d",
    comparison: windowInput?.comparison ?? "previous",
  });
  if (!wr.ok) return Response.json({ error: wr.error }, { status: 400 });

  try {
    const draft = await runInsightDraft(projectId, wr.window, provider);
    return Response.json({
      draftId: encodeURIComponent(draft.draftId),
      status: "ok",
      facts: draft.facts,
      issues: draft.issues,
      period: draft.period,
      previousPeriod: draft.previousPeriod,
      comparison: draft.comparison,
      provider: draft.modelProvider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message, status: "failed" }, { status: 500 });
  }
}
