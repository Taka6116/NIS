import { getSessionUserRole, requireSession, isAuthError } from "@/lib/rbac";
import { getInsight } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { generateSlideOutline } from "@/lib/insights/export-slide-outline";
import { createSlidesFromOutline } from "@/lib/integrations/google-slides";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ projectId: string; insightId: string }> },
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
  const { projectId, insightId } = await ctx.params;
  const sk = decodeURIComponent(insightId);
  const [insight, project] = await Promise.all([getInsight(projectId, sk), getProject(projectId)]);
  if (!insight || !project) return Response.json({ error: "Not Found" }, { status: 404 });

  const outlineText = generateSlideOutline({
    insight,
    projectName: project.projectName,
    domain: project.domain,
  });
  const title = `${project.projectName} インサイト ${insight.period.start}〜${insight.period.end}`;

  try {
    const res = await createSlidesFromOutline({ title, outlineText });
    return Response.json({ ok: true, ...res });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
