import { google } from "googleapis";
import type { GscDailyRow } from "@/types/nis";
import { getServiceAccountCredentials } from "@/lib/integrations/google-credentials";

function sanitizePart(s: string): string {
  return s.replaceAll("#", "_").slice(0, 400);
}

export async function fetchGscDailyRows(opts: {
  projectId: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<GscDailyRow[]> {
  const creds = getServiceAccountCredentials();
  if (!creds) return [];

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const webmasters = google.searchconsole({ version: "v1", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl: opts.siteUrl,
    requestBody: {
      startDate: opts.startDate,
      endDate: opts.endDate,
      dimensions: ["date", "query", "page"],
      rowLimit: 25000,
      dataState: "all",
    },
  });

  const rows = res.data.rows ?? [];
  const out: GscDailyRow[] = [];
  for (const r of rows) {
    const dims = r.keys ?? [];
    const date = dims[0] ?? "";
    const query = dims[1] ?? "";
    const page = dims[2] ?? "";
    const sk = `${date}#${sanitizePart(query)}#${sanitizePart(page)}`;
    out.push({
      projectId: opts.projectId,
      sk,
      date,
      query,
      page,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    });
  }
  return out;
}
