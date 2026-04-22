import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase, isTableNotFoundError } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";

export type InsightShareRecord = {
  /** PK */
  token: string;
  projectId: string;
  sk: string;
  createdAt: string;
  /** epoch seconds (TTL) */
  expiresAt?: number;
};

export async function putShare(row: InsightShareRecord): Promise<void> {
  if (isMockDatabase()) {
    mockStore.insightShares.set(row.token, row);
    return;
  }
  try {
    await getDynamoClient().send(
      new PutCommand({ TableName: tableNames.insightShares, Item: row }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) {
      throw new Error(
        `DynamoDB テーブル '${tableNames.insightShares}' が存在しません。AWS コンソールでこのテーブルを作成してください（PK: token）。`,
      );
    }
    throw e;
  }
}

export async function getShare(token: string): Promise<InsightShareRecord | null> {
  if (isMockDatabase()) {
    return mockStore.insightShares.get(token) ?? null;
  }
  try {
    const out = await getDynamoClient().send(
      new GetCommand({ TableName: tableNames.insightShares, Key: { token } }),
    );
    return (out.Item as InsightShareRecord | undefined) ?? null;
  } catch (e) {
    if (isTableNotFoundError(e)) return null;
    throw e;
  }
}

export async function deleteShare(token: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.insightShares.delete(token);
    return;
  }
  try {
    await getDynamoClient().send(
      new DeleteCommand({ TableName: tableNames.insightShares, Key: { token } }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) return;
    throw e;
  }
}

/** token 生成（crypto.randomUUID を使う） */
export function generateShareToken(): string {
  const rand = globalThis.crypto?.randomUUID?.();
  if (rand) return rand.replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
