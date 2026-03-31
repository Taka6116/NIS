import { listProjects } from "@/lib/dynamodb/repositories/projects";
import { syncProjectData } from "@/lib/sync/run-sync";
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
      await syncProjectData(p.projectId, { days: 7 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.projectId}: ${msg}`);
    }
  }
  if (errors.length) {
    await notifySlack(`NIS sync-data failures:\n${errors.join("\n")}`);
  }
  return Response.json({ ok: true, processed: projects.length, errors });
}
