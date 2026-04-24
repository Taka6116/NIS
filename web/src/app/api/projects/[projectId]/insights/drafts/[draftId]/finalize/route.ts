import { runInsightFinalize, type InsightProvider } from "@/lib/insights/run-generate";
import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import type { InsightIssue } from "@/types/nis";

function parseProvider(body: unknown): InsightProvider {
  if (!body || typeof body !== "object") return "gemini";
  const p = (body as { provider?: unknown }).provider;
  if (p === "claude") return "claude";
  return "gemini";
}

function parseIssues(body: unknown): InsightIssue[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const raw = (body as { editedIssues?: unknown }).editedIssues;
  if (!Array.isArray(raw)) return undefined;
  const out: InsightIssue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.title !== "string" || typeof r.description !== "string") continue;
    const severity = r.severity === "high" || r.severity === "medium" || r.severity === "low" ? r.severity : "medium";
    const category =
      r.category === "seo" || r.category === "traffic" || r.category === "ux" || r.category === "conversion"
        ? r.category
        : "seo";
    const related = Array.isArray(r.relatedFactIds) ? (r.relatedFactIds.filter((x) => typeof x === "string") as string[]) : [];
    out.push({
      id: r.id,
      severity,
      title: r.title,
      description: r.description,
      relatedFactIds: related,
      category,
    });
  }
  return out;
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
  let editedIssues: InsightIssue[] | undefined;
  try {
    const json = (await req.json()) as unknown;
    provider = parseProvider(json);
    editedIssues = parseIssues(json);
  } catch {
    /* empty body */
  }

  try {
    const row = await runInsightFinalize(projectId, draftId, provider, { editedIssues });
    return Response.json({
      insightId: encodeURIComponent(row.sk),
      status: "ok",
      summary: row.summary,
      provider: row.modelProvider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[finalize] error:", message, stack);
    return Response.json({ error: message, detail: stack?.slice(0, 500), status: "failed" }, { status: 500 });
  }
}
