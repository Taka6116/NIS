import { fetchClarityLiveInsights, clarityDashboardUrl } from "@/lib/integrations/clarity";
import { fetchGa4DailyRows } from "@/lib/integrations/ga4";
import { fetchGscDailyRows } from "@/lib/integrations/gsc";
import { putClarityRows, putGa4Rows, putGscRows } from "@/lib/dynamodb/repositories/metrics";
import {
  ensureDefaultProject,
  getProject,
  updateProjectSyncMeta,
} from "@/lib/dynamodb/repositories/projects";
import { format, subDays } from "date-fns";

export type SyncResult = {
  gscCount: number;
  ga4Count: number;
  clarityCount: number;
  claritySkipped: boolean;
  claritySkipReason?: string;
  clarityError?: string;
  clarityUrl: string | null;
};

export async function syncProjectData(
  projectId: string,
  opts?: { days?: number; clarityToken?: string },
): Promise<SyncResult> {
  await ensureDefaultProject();

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

  const clarityPid =
    project.clarityProjectId || process.env.NIS_DEFAULT_CLARITY_PROJECT_ID || "";
  const token =
    opts?.clarityToken ?? process.env.CLARITY_API_TOKEN ?? project.clarityApiTokenEncrypted ?? "";

  if (!clarityPid) {
    return {
      gscCount: gscRows.length,
      ga4Count: ga4Rows.length,
      clarityCount: 0,
      claritySkipped: true,
      claritySkipReason: "Clarity Project ID が未設定です",
      clarityUrl: null,
    };
  }
  if (!token) {
    return {
      gscCount: gscRows.length,
      ga4Count: ga4Rows.length,
      clarityCount: 0,
      claritySkipped: true,
      claritySkipReason: "Clarity API トークンが未設定です",
      clarityUrl: clarityDashboardUrl(clarityPid),
    };
  }

  let clarityRows: Awaited<ReturnType<typeof fetchClarityLiveInsights>> = [];
  let clarityError: string | undefined;
  try {
    clarityRows = await fetchClarityLiveInsights({
      projectId,
      clarityProjectId: clarityPid,
      token,
      numOfDays: 1,
    });
    await putClarityRows(clarityRows);
    await updateProjectSyncMeta(projectId, {
      lastClaritySyncAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
    });
  } catch (e) {
    clarityError = e instanceof Error ? e.message : "Unknown Clarity error";
  }

  return {
    gscCount: gscRows.length,
    ga4Count: ga4Rows.length,
    clarityCount: clarityRows.length,
    claritySkipped: false,
    clarityError,
    clarityUrl: clarityDashboardUrl(clarityPid),
  };
}
