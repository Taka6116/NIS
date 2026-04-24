import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase, isTableNotFoundError } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { AhrefsDataset } from "@/types/nis";

export class KwDatasetTableMissingError extends Error {
  constructor(tableName: string) {
    super(
      `DynamoDB テーブル '${tableName}' が存在しません。AWS コンソールでこのテーブルを作成してください（PK: projectId(String), SK: sk(String), Billing: PAY_PER_REQUEST）。`,
    );
    this.name = "KwDatasetTableMissingError";
  }
}

export class KwDatasetTooLargeError extends Error {
  constructor(sizeKB: number) {
    super(
      `CSV のデータ量が DynamoDB の 400KB 上限を超過しています（約 ${sizeKB}KB）。より小さい CSV に分割してインポートしてください。`,
    );
    this.name = "KwDatasetTooLargeError";
  }
}

function mockKey(projectId: string, id: string) {
  return `${projectId}::dataset#${id}`;
}

export async function putKwDataset(dataset: AhrefsDataset): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.set(mockKey(dataset.projectId, dataset.id), dataset);
    return;
  }
  const item = { ...dataset, sk: `dataset#${dataset.id}` };
  const sizeBytes = Buffer.byteLength(JSON.stringify(item), "utf8");
  if (sizeBytes > 390 * 1024) {
    throw new KwDatasetTooLargeError(Math.round(sizeBytes / 1024));
  }
  try {
    await getDynamoClient().send(
      new PutCommand({
        TableName: tableNames.kwDatasets,
        Item: item,
      }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) {
      throw new KwDatasetTableMissingError(tableNames.kwDatasets);
    }
    throw e;
  }
}

export async function listKwDatasets(projectId: string): Promise<AhrefsDataset[]> {
  if (isMockDatabase()) {
    const prefix = `${projectId}::dataset#`;
    return [...mockStore.kwDatasets.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
  try {
    const res = await getDynamoClient().send(
      new QueryCommand({
        TableName: tableNames.kwDatasets,
        KeyConditionExpression: "projectId = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": projectId, ":prefix": "dataset#" },
      }),
    );
    return ((res.Items ?? []) as AhrefsDataset[]).sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) {
      console.warn(
        `[kw-datasets] table '${tableNames.kwDatasets}' not found; returning empty list`,
      );
      return [];
    }
    throw e;
  }
}

export async function deleteKwDataset(projectId: string, id: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.delete(mockKey(projectId, id));
    return;
  }
  try {
    await getDynamoClient().send(
      new DeleteCommand({
        TableName: tableNames.kwDatasets,
        Key: { projectId, sk: `dataset#${id}` },
      }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) return;
    throw e;
  }
}
