import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import {
  defaultAlertConfig,
  getProjectAlertConfig,
  putProjectAlertConfig,
} from "@/lib/dynamodb/repositories/project-alerts";
import type { ProjectAlertConfig } from "@/types/nis";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const existing = await getProjectAlertConfig(projectId);
  return Response.json({ config: existing ?? defaultAlertConfig(projectId) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const meta = await getSessionUserRole();
  if (!meta || meta.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { projectId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<ProjectAlertConfig>;
  const next: ProjectAlertConfig = {
    projectId,
    sk: "config",
    enabled: body.enabled === true,
    rules: Array.isArray(body.rules) ? body.rules : [],
    slackWebhookUrl: typeof body.slackWebhookUrl === "string" ? body.slackWebhookUrl : undefined,
    autoTriggerDraft: body.autoTriggerDraft === true,
    updatedAtIso: new Date().toISOString(),
  };
  await putProjectAlertConfig(next);
  return Response.json({ ok: true, config: next });
}
