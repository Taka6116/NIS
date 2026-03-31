import { getProject } from "@/lib/dynamodb/repositories/projects";
import { requireSession, isAuthError } from "@/lib/rbac";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  try { await requireSession(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { projectId } = await ctx.params;
  const project = await getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ project });
}
