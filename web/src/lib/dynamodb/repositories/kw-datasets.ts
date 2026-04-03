import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { AhrefsDataset } from "@/types/nis";

function mockKey(projectId: string, id: string) {
  return `${projectId}::dataset#${id}`;
}

export async function putKwDataset(dataset: AhrefsDataset): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.set(mockKey(dataset.projectId, dataset.id), dataset);
    return;
  }
  await getDynamoClient().send(
    new PutCommand({
      TableName: tableNames.kwDatasets,
      Item: { ...dataset, sk: `dataset#${dataset.id}` },
    }),
  );
}

export async function listKwDatasets(projectId: string): Promise<AhrefsDataset[]> {
  if (isMockDatabase()) {
    const prefix = `${projectId}::dataset#`;
    return [...mockStore.kwDatasets.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => v)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
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
}

export async function deleteKwDataset(projectId: string, id: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.delete(mockKey(projectId, id));
    return;
  }
  await getDynamoClient().send(
    new DeleteCommand({
      TableName: tableNames.kwDatasets,
      Key: { projectId, sk: `dataset#${id}` },
    }),
  );
}
