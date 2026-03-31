import { clarityDashboardUrl } from "@/lib/integrations/clarity";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { requireSession, isAuthError } from "@/lib/rbac";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const project = await getProject(projectId);
  if (!project?.clarityProjectId) {
    return Response.json({ url: null, error: "Clarity project not configured" }, { status: 400 });
  }
  return Response.json({ url: clarityDashboardUrl(project.clarityProjectId) });
}
