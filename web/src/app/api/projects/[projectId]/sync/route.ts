import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import { syncProjectData } from "@/lib/sync/run-sync";

export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || meta.role === "viewer") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
  try {
    const result = await syncProjectData(projectId, { days: 28 });
    return Response.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
