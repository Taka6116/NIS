import { isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import { batchWriteWithRetry, queryAllPages } from "@/lib/dynamodb/helpers";
import type { ClarityDailyRow, Ga4DailyRow, GscDailyRow } from "@/types/nis";

function gscKey(projectId: string, sk: string) {
  return `${projectId}::${sk}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function putGscRows(rows: GscDailyRow[]): Promise<void> {
  if (!rows.length) return;
  if (isMockDatabase()) {
    for (const r of rows) {
      mockStore.gsc.set(gscKey(r.projectId, r.sk), r);
    }
    return;
  }
  for (const part of chunk(rows, 25)) {
    await batchWriteWithRetry({
      RequestItems: {
        [tableNames.gscDaily]: part.map((r) => ({
          PutRequest: { Item: { ...r } },
        })),
      },
    });
  }
}

export async function putGa4Rows(rows: Ga4DailyRow[]): Promise<void> {
  if (!rows.length) return;
  if (isMockDatabase()) {
    for (const r of rows) {
      mockStore.ga4.set(gscKey(r.projectId, r.sk), r);
    }
    return;
  }
  for (const part of chunk(rows, 25)) {
    await batchWriteWithRetry({
      RequestItems: {
        [tableNames.ga4Daily]: part.map((r) => ({
          PutRequest: { Item: { ...r } },
        })),
      },
    });
  }
}

export async function putClarityRows(rows: ClarityDailyRow[]): Promise<void> {
  if (!rows.length) return;
  if (isMockDatabase()) {
    for (const r of rows) {
      mockStore.clarity.set(gscKey(r.projectId, r.sk), r);
    }
    return;
  }
  for (const part of chunk(rows, 25)) {
    await batchWriteWithRetry({
      RequestItems: {
        [tableNames.clarityDaily]: part.map((r) => ({
          PutRequest: { Item: { ...r } },
        })),
      },
    });
  }
}

export async function queryGscByProjectAndDatePrefix(
  projectId: string,
  datePrefix: string,
): Promise<GscDailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.gsc.values()].filter(
      (r) => r.projectId === projectId && r.sk.startsWith(datePrefix),
    );
  }
  return queryAllPages<GscDailyRow>({
    TableName: tableNames.gscDaily,
    KeyConditionExpression: "projectId = :p AND begins_with(#sk, :d)",
    ExpressionAttributeNames: { "#sk": "sk" },
    ExpressionAttributeValues: { ":p": projectId, ":d": datePrefix },
  });
}

export async function queryGa4ByProject(projectId: string): Promise<Ga4DailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.ga4.values()].filter((r) => r.projectId === projectId);
  }
  return queryAllPages<Ga4DailyRow>({
    TableName: tableNames.ga4Daily,
    KeyConditionExpression: "projectId = :p",
    ExpressionAttributeValues: { ":p": projectId },
  });
}

export async function queryGa4ByProjectAndDateRange(
  projectId: string,
  start: string,
  end: string,
): Promise<Ga4DailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.ga4.values()].filter(
      (r) => r.projectId === projectId && r.date >= start && r.date <= end,
    );
  }
  return queryAllPages<Ga4DailyRow>({
    TableName: tableNames.ga4Daily,
    KeyConditionExpression: "projectId = :p AND #sk BETWEEN :s AND :e",
    ExpressionAttributeNames: { "#sk": "sk" },
    ExpressionAttributeValues: { ":p": projectId, ":s": start, ":e": `${end}~` },
  });
}

export async function queryClarityByProject(projectId: string): Promise<ClarityDailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.clarity.values()].filter((r) => r.projectId === projectId);
  }
  return queryAllPages<ClarityDailyRow>({
    TableName: tableNames.clarityDaily,
    KeyConditionExpression: "projectId = :p",
    ExpressionAttributeValues: { ":p": projectId },
  });
}

