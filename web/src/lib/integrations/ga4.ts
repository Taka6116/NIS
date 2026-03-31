import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { Ga4DailyRow } from "@/types/nis";
import { getServiceAccountCredentials } from "@/lib/integrations/google-credentials";

function smKey(source: string, medium: string) {
  const s = source || "(not set)";
  const m = medium || "(not set)";
  return `${s} / ${m}`.replaceAll("#", "_").slice(0, 200);
}

function sanitizePath(p: string) {
  return p.replaceAll("#", "_").slice(0, 400);
}

function sanitizeSeg(s: string) {
  return s.replaceAll("#", "_").slice(0, 200);
}

async function runGa4Report(client: BetaAnalyticsDataClient, propertyId: string, body: {
  dimensions: { name: string }[];
  metrics: { name: string }[];
  limit?: number;
} & { startDate: string; endDate: string }) {
  const { startDate, endDate, ...rest } = body;
  const [resp] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    ...rest,
    limit: rest.limit ?? 100000,
  });
  return resp;
}

async function fetchGa4MainRows(
  client: BetaAnalyticsDataClient,
  opts: { projectId: string; propertyId: string; startDate: string; endDate: string },
): Promise<Ga4DailyRow[]> {
  const resp = await runGa4Report(client, opts.propertyId, {
    startDate: opts.startDate,
    endDate: opts.endDate,
    dimensions: [
      { name: "date" },
      { name: "pagePath" },
      { name: "sessionSource" },
      { name: "sessionMedium" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "screenPageViews" },
      { name: "averageSessionDuration" },
      { name: "bounceRate" },
      { name: "conversions" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "userEngagementDuration" },
    ],
  });

  const out: Ga4DailyRow[] = [];
  for (const row of resp.rows ?? []) {
    const dim = row.dimensionValues ?? [];
    const rawDate = dim[0]?.value ?? "";
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const pagePath = dim[1]?.value ?? "";
    const source = dim[2]?.value ?? "";
    const medium = dim[3]?.value ?? "";
    const met = row.metricValues ?? [];
    const sk = `${date}#${sanitizePath(pagePath)}#${smKey(source, medium)}`;
    out.push({
      projectId: opts.projectId,
      sk,
      date,
      rowType: "main",
      pagePath,
      sourceMedium: smKey(source, medium),
      sessions: Number(met[0]?.value ?? 0),
      activeUsers: Number(met[1]?.value ?? 0),
      newUsers: Number(met[2]?.value ?? 0),
      pageViews: Number(met[3]?.value ?? 0),
      avgSessionDuration: Number(met[4]?.value ?? 0),
      bounceRate: Number(met[5]?.value ?? 0),
      conversions: Number(met[6]?.value ?? 0),
      engagedSessions: Number(met[7]?.value ?? 0),
      engagementRate: Number(met[8]?.value ?? 0),
      userEngagementDuration: Number(met[9]?.value ?? 0),
    });
  }
  return out;
}

async function fetchGa4ChannelRows(
  client: BetaAnalyticsDataClient,
  opts: { projectId: string; propertyId: string; startDate: string; endDate: string },
): Promise<Ga4DailyRow[]> {
  const resp = await runGa4Report(client, opts.propertyId, {
    startDate: opts.startDate,
    endDate: opts.endDate,
    dimensions: [
      { name: "date" },
      { name: "sessionDefaultChannelGroup" },
      { name: "landingPage" },
    ],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "engagedSessions" },
      { name: "engagementRate" },
      { name: "conversions" },
    ],
  });

  const out: Ga4DailyRow[] = [];
  for (const row of resp.rows ?? []) {
    const dim = row.dimensionValues ?? [];
    const rawDate = dim[0]?.value ?? "";
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const channelGroup = dim[1]?.value ?? "(not set)";
    const landingPage = dim[2]?.value ?? "(not set)";
    const met = row.metricValues ?? [];
    const sk = `${date}#ch#${sanitizeSeg(channelGroup)}#${sanitizePath(landingPage)}`;
    out.push({
      projectId: opts.projectId,
      sk,
      date,
      rowType: "channel",
      channelGroup,
      landingPage,
      sessions: Number(met[0]?.value ?? 0),
      activeUsers: Number(met[1]?.value ?? 0),
      newUsers: 0,
      pageViews: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversions: Number(met[4]?.value ?? 0),
      engagedSessions: Number(met[2]?.value ?? 0),
      engagementRate: Number(met[3]?.value ?? 0),
      userEngagementDuration: 0,
    });
  }
  return out;
}

async function fetchGa4DeviceGeoRows(
  client: BetaAnalyticsDataClient,
  opts: { projectId: string; propertyId: string; startDate: string; endDate: string },
): Promise<Ga4DailyRow[]> {
  const resp = await runGa4Report(client, opts.propertyId, {
    startDate: opts.startDate,
    endDate: opts.endDate,
    dimensions: [{ name: "date" }, { name: "deviceCategory" }, { name: "country" }],
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "bounceRate" },
      { name: "userEngagementDuration" },
    ],
  });

  const out: Ga4DailyRow[] = [];
  for (const row of resp.rows ?? []) {
    const dim = row.dimensionValues ?? [];
    const rawDate = dim[0]?.value ?? "";
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const deviceCategory = dim[1]?.value ?? "(not set)";
    const country = dim[2]?.value ?? "(not set)";
    const met = row.metricValues ?? [];
    const sk = `${date}#dg#${sanitizeSeg(deviceCategory)}#${sanitizeSeg(country)}`;
    out.push({
      projectId: opts.projectId,
      sk,
      date,
      rowType: "deviceGeo",
      deviceCategory,
      country,
      sessions: Number(met[0]?.value ?? 0),
      activeUsers: Number(met[1]?.value ?? 0),
      newUsers: 0,
      pageViews: 0,
      avgSessionDuration: 0,
      bounceRate: Number(met[2]?.value ?? 0),
      conversions: 0,
      userEngagementDuration: Number(met[3]?.value ?? 0),
    });
  }
  return out;
}

export async function fetchGa4DailyRows(opts: {
  projectId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
}): Promise<Ga4DailyRow[]> {
  const creds = getServiceAccountCredentials();
  if (!creds) return [];

  const client = new BetaAnalyticsDataClient({
    credentials: creds,
  });

  const base = {
    projectId: opts.projectId,
    propertyId: opts.propertyId,
    startDate: opts.startDate,
    endDate: opts.endDate,
  };

  const [main, channel, deviceGeo] = await Promise.all([
    fetchGa4MainRows(client, base),
    fetchGa4ChannelRows(client, base),
    fetchGa4DeviceGeoRows(client, base),
  ]);

  return [...main, ...channel, ...deviceGeo];
}
