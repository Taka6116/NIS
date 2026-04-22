import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase, isTableNotFoundError } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { ActionTrackingRecord, InsightActionStatus } from "@/types/nis";

function key(projectId: string, sk: string) {
  return `${projectId}::${sk}`;
}

export function trackingSk(insightSk: string, actionId: string): string {
  return `${insightSk}#${actionId}`;
}

export async function upsertActionTracking(row: ActionTrackingRecord): Promise<void> {
  if (isMockDatabase()) {
    mockStore.actionTracking.set(key(row.projectId, row.sk), row);
    return;
  }
  try {
    await getDynamoClient().send(
      new PutCommand({ TableName: tableNames.actionTracking, Item: row }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) {
      throw new Error(
        `DynamoDB テーブル '${tableNames.actionTracking}' が存在しません。AWS コンソールでこのテーブルを作成してください（PK: projectId, SK: sk）。`,
      );
    }
    throw e;
  }
}

export async function listActionTracking(projectId: string, limit = 500): Promise<ActionTrackingRecord[]> {
  if (isMockDatabase()) {
    return [...mockStore.actionTracking.values()]
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso))
      .slice(0, limit);
  }
  try {
    const out = await getDynamoClient().send(
      new QueryCommand({
        TableName: tableNames.actionTracking,
        KeyConditionExpression: "projectId = :p",
        ExpressionAttributeValues: { ":p": projectId },
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as ActionTrackingRecord[];
  } catch (e) {
    if (isTableNotFoundError(e)) {
      console.warn(
        `[action-tracking] table '${tableNames.actionTracking}' not found; returning empty list`,
      );
      return [];
    }
    throw e;
  }
}

export async function deleteActionTracking(projectId: string, sk: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.actionTracking.delete(key(projectId, sk));
    return;
  }
  try {
    await getDynamoClient().send(
      new DeleteCommand({ TableName: tableNames.actionTracking, Key: { projectId, sk } }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) return;
    throw e;
  }
}

export function buildTrackingRecord(input: {
  projectId: string;
  insightSk: string;
  actionId: string;
  actionTitle: string;
  status: InsightActionStatus;
  updatedBy?: string;
  implementedAtIso?: string;
  actualImpactNote?: string;
  actualMetrics?: Record<string, number>;
}): ActionTrackingRecord {
  return {
    projectId: input.projectId,
    sk: trackingSk(input.insightSk, input.actionId),
    insightSk: input.insightSk,
    actionId: input.actionId,
    actionTitle: input.actionTitle,
    status: input.status,
    updatedAtIso: new Date().toISOString(),
    updatedBy: input.updatedBy,
    implementedAtIso: input.implementedAtIso,
    actualImpactNote: input.actualImpactNote,
    actualMetrics: input.actualMetrics,
  };
}
