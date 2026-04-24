import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { isMockDatabase } from "@/lib/dynamodb/client";
import {
  getKwDatasetBucket,
  getS3Client,
  isBucketNotFoundError,
  isObjectNotFoundError,
} from "@/lib/s3/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import type { AhrefsDataset } from "@/types/nis";

export class KwDatasetBucketMissingError extends Error {
  constructor(bucket: string) {
    super(
      `S3 バケット '${bucket}' が存在しません。AWS コンソールで作成してください（リージョン: ap-northeast-1、ブロックパブリックアクセス: すべて有効）。`,
    );
    this.name = "KwDatasetBucketMissingError";
  }
}

function mockKey(projectId: string, id: string) {
  return `${projectId}::dataset#${id}`;
}

function s3Key(projectId: string, id: string): string {
  return `projects/${projectId}/kw-datasets/${id}.json`;
}

function s3Prefix(projectId: string): string {
  return `projects/${projectId}/kw-datasets/`;
}

export async function putKwDataset(dataset: AhrefsDataset): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.set(mockKey(dataset.projectId, dataset.id), dataset);
    return;
  }
  const bucket = getKwDatasetBucket();
  const body = JSON.stringify(dataset);
  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key(dataset.projectId, dataset.id),
        Body: body,
        ContentType: "application/json; charset=utf-8",
      }),
    );
  } catch (e) {
    if (isBucketNotFoundError(e)) {
      throw new KwDatasetBucketMissingError(bucket);
    }
    throw e;
  }
}

async function readDatasetObject(bucket: string, key: string): Promise<AhrefsDataset | null> {
  try {
    const res = await getS3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const text = await res.Body?.transformToString("utf-8");
    if (!text) return null;
    return JSON.parse(text) as AhrefsDataset;
  } catch (e) {
    if (isObjectNotFoundError(e)) return null;
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
  const bucket = getKwDatasetBucket();
  const s3 = getS3Client();
  const prefix = s3Prefix(projectId);

  const keys: string[] = [];
  let continuationToken: string | undefined;
  try {
    do {
      const list = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of list.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (e) {
    if (isBucketNotFoundError(e)) {
      console.warn(`[kw-datasets] bucket '${bucket}' not found; returning empty list`);
      return [];
    }
    throw e;
  }

  const results: AhrefsDataset[] = [];
  for (const key of keys) {
    const row = await readDatasetObject(bucket, key);
    if (row) results.push(row);
  }
  return results.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function deleteKwDataset(projectId: string, id: string): Promise<void> {
  if (isMockDatabase()) {
    mockStore.kwDatasets.delete(mockKey(projectId, id));
    return;
  }
  const bucket = getKwDatasetBucket();
  try {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: s3Key(projectId, id),
      }),
    );
  } catch (e) {
    if (isBucketNotFoundError(e)) return;
    throw e;
  }
}
