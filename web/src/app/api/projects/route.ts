import { createProject, listProjects } from "@/lib/dynamodb/repositories/projects";
import { requireSession, requireAdmin, isAuthError } from "@/lib/rbac";
import { z } from "zod";

const createSchema = z.object({
  projectName: z.string().min(1),
  domain: z.string().min(1),
  gscPropertyUrl: z.string().min(1).or(z.string().length(0)).default(""),
  ga4PropertyId: z.string().min(1).or(z.string().length(0)).default(""),
  clarityProjectId: z.string().optional(),
});

export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const projects = await listProjects();
  return Response.json({
    projects: projects.map((p) => ({
      id: p.projectId,
      name: p.projectName,
      domain: p.domain,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  // プロジェクト作成は admin 限定
  try {
    await requireAdmin();
  } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const project = await createProject(parsed.data);
    return Response.json({ project });
  } catch (e) {
    console.error("Failed to create project:", e);
    return Response.json({ error: "Project creation failed" }, { status: 500 });
  }
}
