export const tableNames = {
  projects: process.env.NIS_TABLE_PROJECTS ?? "nis-projects",
  gscDaily: process.env.NIS_TABLE_GSC_DAILY ?? "nis-gsc-daily",
  ga4Daily: process.env.NIS_TABLE_GA4_DAILY ?? "nis-ga4-daily",
  clarityDaily: process.env.NIS_TABLE_CLARITY_DAILY ?? "nis-clarity-daily",
  insights: process.env.NIS_TABLE_INSIGHTS ?? "nis-insights",
  users: process.env.NIS_TABLE_USERS ?? "nis-users",
};
