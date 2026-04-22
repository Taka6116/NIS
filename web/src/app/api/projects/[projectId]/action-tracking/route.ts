import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import {
  buildTrackingRecord,
  listActionTracking,
  upsertActionTracking,
} from "@/lib/dynamodb/repositories/action-tracking";
import type { InsightActionStatus } from "@/types/nis";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const rows = await listActionTracking(projectId);
  return Response.json({ rows });
}

const ALLOWED: InsightActionStatus[] = ["todo", "in-progress", "done", "rejected"];

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
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Bad Request" }, { status: 400 });
  }
  const insightSk = typeof body.insightSk === "string" ? body.insightSk : "";
  const actionId = typeof body.actionId === "string" ? body.actionId : "";
  const actionTitle = typeof body.actionTitle === "string" ? body.actionTitle : "";
  const status = body.status as InsightActionStatus;
  if (!insightSk || !actionId || !actionTitle || !ALLOWED.includes(status)) {
    return Response.json({ error: "validation failed" }, { status: 400 });
  }
  const rec = buildTrackingRecord({
    projectId,
    insightSk,
    actionId,
    actionTitle,
    status,
    updatedBy: meta.email,
    implementedAtIso:
      typeof body.implementedAtIso === "string" ? body.implementedAtIso : status === "done" ? new Date().toISOString() : undefined,
    actualImpactNote: typeof body.actualImpactNote === "string" ? body.actualImpactNote : undefined,
    actualMetrics:
      body.actualMetrics && typeof body.actualMetrics === "object"
        ? (body.actualMetrics as Record<string, number>)
        : undefined,
  });
  await upsertActionTracking(rec);
  return Response.json({ ok: true, row: rec });
}
