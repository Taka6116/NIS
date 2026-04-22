import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { InsightDraftRecord, InsightRecord } from "@/types/nis";

function key(projectId: string, sk: string) {
  return `${projectId}::${sk}`;
}

export async function putInsight(row: InsightRecord): Promise<void> {
  if (isMockDatabase()) {
    mockStore.insights.set(key(row.projectId, row.sk), row);
    return;
  }
  await getDynamoClient().send(
    new PutCommand({
      TableName: tableNames.insights,
      Item: row,
    }),
  );
}

export async function listInsights(projectId: string, limit = 20): Promise<InsightRecord[]> {
  if (isMockDatabase()) {
    return [...mockStore.insights.values()]
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => b.generatedAtIso.localeCompare(a.generatedAtIso))
      .slice(0, limit);
  }
  const out = await getDynamoClient().send(
    new QueryCommand({
      TableName: tableNames.insights,
      KeyConditionExpression: "projectId = :p",
      FilterExpression: "attribute_not_exists(#t) OR #t <> :draft",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":p": projectId, ":draft": "draft" },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (out.Items ?? []) as InsightRecord[];
}

export async function getInsight(projectId: string, sk: string): Promise<InsightRecord | null> {
  if (isMockDatabase()) {
    return mockStore.insights.get(key(projectId, sk)) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({
      TableName: tableNames.insights,
      Key: { projectId, sk },
    }),
  );
  return (out.Item as InsightRecord | undefined) ?? null;
}

/* ---------------- Drafts ---------------- */

/** draftId → sk への変換（`sk = "{iso}#draft"` を採用） */
export function draftSkFromId(draftId: string): string {
  return `${draftId}#draft`;
}

export async function putInsightDraft(row: InsightDraftRecord): Promise<void> {
  if (isMockDatabase()) {
    mockStore.insightDrafts.set(key(row.projectId, row.sk), row);
    return;
  }
  await getDynamoClient().send(
    new PutCommand({
      TableName: tableNames.insights,
      Item: row,
    }),
  );
}

export async function getInsightDraft(
  projectId: string,
  draftId: string,
): Promise<InsightDraftRecord | null> {
  const sk = draftSkFromId(draftId);
  if (isMockDatabase()) {
    return mockStore.insightDrafts.get(key(projectId, sk)) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({
      TableName: tableNames.insights,
      Key: { projectId, sk },
    }),
  );
  const item = out.Item as InsightDraftRecord | undefined;
  if (!item || item.type !== "draft") return null;
  return item;
}

export async function deleteInsightDraft(projectId: string, draftId: string): Promise<void> {
  const sk = draftSkFromId(draftId);
  if (isMockDatabase()) {
    mockStore.insightDrafts.delete(key(projectId, sk));
    return;
  }
  await getDynamoClient().send(
    new DeleteCommand({
      TableName: tableNames.insights,
      Key: { projectId, sk },
    }),
  );
}
