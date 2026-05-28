import { getProject, updateProjectCredentials } from "@/lib/dynamodb/repositories/projects";
import { requireProjectAccess, isAuthError } from "@/lib/rbac";
import { z } from "zod";

const schema = z.object({
  gscPropertyUrl: z.string().optional(),
  ga4PropertyId: z.string().optional(),
  clarityProjectId: z.string().optional(),
  clarityApiTokenEncrypted: z.string().optional(),
  googleServiceSecretRef: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  try {
    // credentials 更新は admin 限定
    await requireProjectAccess(projectId, ["admin"]);
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const project = await getProject(projectId);
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const token =
    parsed.data.clarityApiTokenEncrypted && parsed.data.clarityApiTokenEncrypted.length > 0
      ? parsed.data.clarityApiTokenEncrypted
      : project.clarityApiTokenEncrypted;

  await updateProjectCredentials(projectId, {
    gscPropertyUrl: parsed.data.gscPropertyUrl ?? project.gscPropertyUrl,
    ga4PropertyId: parsed.data.ga4PropertyId ?? project.ga4PropertyId,
    clarityProjectId: parsed.data.clarityProjectId ?? project.clarityProjectId,
    clarityApiTokenEncrypted: token,
    googleServiceSecretRef: parsed.data.googleServiceSecretRef ?? project.googleServiceSecretRef,
  });

  return Response.json({ ok: true });
}
