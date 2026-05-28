import { requireProjectAccess, isAuthError } from "@/lib/rbac";
import { syncProjectData } from "@/lib/sync/run-sync";

export async function POST(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  try {
    // member 以上かつ対象 project へのアクセス権を確認
    await requireProjectAccess(projectId, ["member", "admin"]);
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  try {
    const result = await syncProjectData(projectId, { days: 28 });
    return Response.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
