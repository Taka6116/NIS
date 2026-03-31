import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { ClarityDailyRow, Ga4DailyRow, GscDailyRow } from "@/types/nis";

function gscKey(projectId: string, sk: string) {
  return `${projectId}::${sk}`;
}

export async function putGscRows(rows: GscDailyRow[]): Promise<void> {
  if (!rows.length) return;
  if (isMockDatabase()) {
    for (const r of rows) {
      mockStore.gsc.set(gscKey(r.projectId, r.sk), r);
    }
    return;
  }
  const chunks = chunk(rows, 25);
  for (const part of chunks) {
    await getDynamoClient().send(
      new BatchWriteCommand({
        RequestItems: {
          [tableNames.gscDaily]: part.map((r) => ({
            PutRequest: { Item: { ...r } },
          })),
        },
      }),
    );
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
  const chunks = chunk(rows, 25);
  for (const part of chunks) {
    await getDynamoClient().send(
      new BatchWriteCommand({
        RequestItems: {
          [tableNames.ga4Daily]: part.map((r) => ({
            PutRequest: { Item: { ...r } },
          })),
        },
      }),
    );
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
  const chunks = chunk(rows, 25);
  for (const part of chunks) {
    await getDynamoClient().send(
      new BatchWriteCommand({
        RequestItems: {
          [tableNames.clarityDaily]: part.map((r) => ({
            PutRequest: { Item: { ...r } },
          })),
        },
      }),
    );
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function queryGscByProjectAndDatePrefix(
  projectId: string,
  datePrefix: string,
): Promise<GscDailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.gsc.values()].filter((r) => r.projectId === projectId && r.sk.startsWith(datePrefix));
  }
  const out = await getDynamoClient().send(
    new QueryCommand({
      TableName: tableNames.gscDaily,
      KeyConditionExpression: "projectId = :p AND begins_with(#sk, :d)",
      ExpressionAttributeNames: { "#sk": "sk" },
      ExpressionAttributeValues: { ":p": projectId, ":d": datePrefix },
    }),
  );
  return (out.Items ?? []) as GscDailyRow[];
}

export async function queryGa4ByProject(projectId: string): Promise<Ga4DailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.ga4.values()].filter((r) => r.projectId === projectId);
  }
  const out = await getDynamoClient().send(
    new QueryCommand({
      TableName: tableNames.ga4Daily,
      KeyConditionExpression: "projectId = :p",
      ExpressionAttributeValues: { ":p": projectId },
    }),
  );
  return (out.Items ?? []) as Ga4DailyRow[];
}

export async function queryClarityByProject(projectId: string): Promise<ClarityDailyRow[]> {
  if (isMockDatabase()) {
    return [...mockStore.clarity.values()].filter((r) => r.projectId === projectId);
  }
  const out = await getDynamoClient().send(
    new QueryCommand({
      TableName: tableNames.clarityDaily,
      KeyConditionExpression: "projectId = :p",
      ExpressionAttributeValues: { ":p": projectId },
    }),
  );
  return (out.Items ?? []) as ClarityDailyRow[];
}
