import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
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
  await getDynamoClient().send(
    new PutCommand({ TableName: tableNames.insightShares, Item: row }),
  );
}

export async function getShare(token: string): Promise<InsightShareRecord | null> {
  if (isMockDatabase()) {
    return mockStore.insightShares.get(token) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({ TableName: tableNames.insightShares, Key: { token } }),
  );
  return (out.Item as InsightShareRecord | undefined) ?? null;
}

export async function deleteShare(token: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.insightShares.delete(token);
    return;
  }
  await getDynamoClient().send(
    new DeleteCommand({ TableName: tableNames.insightShares, Key: { token } }),
  );
}

/** token 生成（crypto.randomUUID を使う） */
export function generateShareToken(): string {
  const rand = globalThis.crypto?.randomUUID?.();
  if (rand) return rand.replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
