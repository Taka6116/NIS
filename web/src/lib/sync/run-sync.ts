import { fetchClarityLiveInsights, clarityDashboardUrl } from "@/lib/integrations/clarity";
import { fetchGa4DailyRows } from "@/lib/integrations/ga4";
import { fetchGscDailyRows } from "@/lib/integrations/gsc";
import { putClarityRows, putGa4Rows, putGscRows } from "@/lib/dynamodb/repositories/metrics";
import { getProject, updateProjectSyncMeta } from "@/lib/dynamodb/repositories/projects";
import { format, subDays } from "date-fns";

export async function syncProjectData(projectId: string, opts?: { days?: number; clarityToken?: string }) {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const days = opts?.days ?? 28;
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const [gscRows, ga4Rows] = await Promise.all([
    fetchGscDailyRows({
      projectId,
      siteUrl: project.gscPropertyUrl,
      startDate: start,
      endDate: end,
    }),
    fetchGa4DailyRows({
      projectId,
      propertyId: project.ga4PropertyId,
      startDate: start,
      endDate: end,
    }),
  ]);

  await putGscRows(gscRows);
  await putGa4Rows(ga4Rows);

  const now = new Date().toISOString();
  await updateProjectSyncMeta(projectId, {
    lastGscSyncAt: now,
    lastGa4SyncAt: now,
    lastSyncAt: now,
  });

  let clarityRows: Awaited<ReturnType<typeof fetchClarityLiveInsights>> = [];
  const token =
    opts?.clarityToken ?? process.env.CLARITY_API_TOKEN ?? project.clarityApiTokenEncrypted ?? "";
  if (project.clarityProjectId && token) {
    clarityRows = await fetchClarityLiveInsights({
      projectId,
      clarityProjectId: project.clarityProjectId,
      token,
      numOfDays: 1,
    });
    await putClarityRows(clarityRows);
    await updateProjectSyncMeta(projectId, {
      lastClaritySyncAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
    });
  }

  return {
    gscCount: gscRows.length,
    ga4Count: ga4Rows.length,
    clarityCount: clarityRows.length,
    clarityUrl: project.clarityProjectId ? clarityDashboardUrl(project.clarityProjectId) : null,
  };
}
