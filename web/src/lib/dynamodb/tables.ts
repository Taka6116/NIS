export const tableNames = {
  projects: process.env.NIS_TABLE_PROJECTS ?? "nis-projects",
  gscDaily: process.env.NIS_TABLE_GSC_DAILY ?? "nis-gsc-daily",
  ga4Daily: process.env.NIS_TABLE_GA4_DAILY ?? "nis-ga4-daily",
  clarityDaily: process.env.NIS_TABLE_CLARITY_DAILY ?? "nis-clarity-daily",
  insights: process.env.NIS_TABLE_INSIGHTS ?? "nis-insights",
  users: process.env.NIS_TABLE_USERS ?? "nis-users",
  kwDatasets: process.env.NIS_TABLE_KW_DATASETS ?? "nis-kw-datasets",
  /** B1: 打ち手トラッキング */
  actionTracking: process.env.NIS_TABLE_ACTION_TRACKING ?? "nis-action-tracking",
  /** B8: アラート閾値設定 */
  projectAlerts: process.env.NIS_TABLE_PROJECT_ALERTS ?? "nis-project-alerts",
  /** B7: 共有トークンインデックス（token → projectId,sk） */
  insightShares: process.env.NIS_TABLE_INSIGHT_SHARES ?? "nis-insight-shares",
};
