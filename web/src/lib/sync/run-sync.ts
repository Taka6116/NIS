import { fetchClarityLiveInsights, clarityDashboardUrl } from "@/lib/integrations/clarity";
import { fetchGa4DailyRows } from "@/lib/integrations/ga4";
import { fetchGscDailyRows } from "@/lib/integrations/gsc";
import { loadServiceAccountCredentials } from "@/lib/integrations/google-credentials";
import { putClarityRows, putGa4Rows, putGscRows } from "@/lib/dynamodb/repositories/metrics";
import {
  ensureDefaultProject,
  getProject,
  updateProjectSyncMeta,
} from "@/lib/dynamodb/repositories/projects";
import { format, subDays } from "date-fns";

export type SourceStatus = "ok" | "skipped_missing_config" | "failed";

export type SyncResult = {
  gscCount: number;
  gscStatus: SourceStatus;
  gscError?: string;
  ga4Count: number;
  ga4Status: SourceStatus;
  ga4Error?: string;
  clarityCount: number;
  clarityStatus: SourceStatus;
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

  // credentials の状態を事前確認（未設定の場合は skipped として扱う）
  const credResult = loadServiceAccountCredentials();

  let gscCount = 0;
  let gscStatus: SourceStatus = "ok";
  let gscError: string | undefined;

  let ga4Count = 0;
  let ga4Status: SourceStatus = "ok";
  let ga4Error: string | undefined;

  if (!credResult.ok) {
    gscStatus = "skipped_missing_config";
    gscError = credResult.message;
    ga4Status = "skipped_missing_config";
    ga4Error = credResult.message;
  } else {
    const [gscRows, ga4Rows] = await Promise.allSettled([
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

    if (gscRows.status === "fulfilled") {
      gscCount = gscRows.value.length;
      await putGscRows(gscRows.value);
      await updateProjectSyncMeta(projectId, { lastGscSyncAt: new Date().toISOString() });
    } else {
      gscStatus = "failed";
      gscError = gscRows.reason instanceof Error ? gscRows.reason.message : String(gscRows.reason);
    }

    if (ga4Rows.status === "fulfilled") {
      ga4Count = ga4Rows.value.length;
      await putGa4Rows(ga4Rows.value);
      await updateProjectSyncMeta(projectId, { lastGa4SyncAt: new Date().toISOString() });
    } else {
      ga4Status = "failed";
      ga4Error = ga4Rows.reason instanceof Error ? ga4Rows.reason.message : String(ga4Rows.reason);
    }
  }

  // lastSyncAt は GSC/GA4 が両方 ok の場合のみ更新する
  if (gscStatus === "ok" && ga4Status === "ok") {
    await updateProjectSyncMeta(projectId, { lastSyncAt: new Date().toISOString() });
  }

  // Clarity
  const clarityPid =
    project.clarityProjectId || process.env.NIS_DEFAULT_CLARITY_PROJECT_ID || "";
  const token =
    opts?.clarityToken ?? process.env.CLARITY_API_TOKEN ?? project.clarityApiTokenEncrypted ?? "";

  if (!clarityPid) {
    return {
      gscCount, gscStatus, gscError,
      ga4Count, ga4Status, ga4Error,
      clarityCount: 0,
      clarityStatus: "skipped_missing_config",
      claritySkipped: true,
      claritySkipReason: "Clarity Project ID が未設定です",
      clarityUrl: null,
    };
  }
  if (!token) {
    return {
      gscCount, gscStatus, gscError,
      ga4Count, ga4Status, ga4Error,
      clarityCount: 0,
      clarityStatus: "skipped_missing_config",
      claritySkipped: true,
      claritySkipReason: "Clarity API トークンが未設定です",
      clarityUrl: clarityDashboardUrl(clarityPid),
    };
  }

  let clarityRows: Awaited<ReturnType<typeof fetchClarityLiveInsights>> = [];
  let clarityStatus: SourceStatus = "ok";
  let clarityError: string | undefined;
  try {
    clarityRows = await fetchClarityLiveInsights({
      projectId,
      clarityProjectId: clarityPid,
      token,
      numOfDays: 3,
    });
    await putClarityRows(clarityRows);
    await updateProjectSyncMeta(projectId, {
      lastClaritySyncAt: new Date().toISOString(),
    });
  } catch (e) {
    clarityStatus = "failed";
    clarityError = e instanceof Error ? e.message : "Unknown Clarity error";
  }

  return {
    gscCount, gscStatus, gscError,
    ga4Count, ga4Status, ga4Error,
    clarityCount: clarityRows.length,
    clarityStatus,
    claritySkipped: false,
    clarityError,
    clarityUrl: clarityDashboardUrl(clarityPid),
  };
}
