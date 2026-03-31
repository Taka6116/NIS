import { listProjects } from "@/lib/dynamodb/repositories/projects";
import { runInsightGeneration } from "@/lib/insights/run-generate";
import { notifySlack } from "@/lib/notify/slack";

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization");
  return h === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const projects = await listProjects();
  const errors: string[] = [];
  for (const p of projects) {
    try {
      await runInsightGeneration(p.projectId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.projectId}: ${msg}`);
    }
  }
  if (errors.length) {
    await notifySlack(`NIS generate-insights failures:\n${errors.join("\n")}`);
  } else {
    await notifySlack(`NIS weekly insights generated for ${projects.length} project(s).`);
  }
  return Response.json({ ok: true, processed: projects.length, errors });
}
