import { S3Client } from "@aws-sdk/client-s3";

function makeClient(): S3Client {
  const region = process.env.AWS_REGION ?? "ap-northeast-1";
  return new S3Client({
    region,
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
}

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_client) _client = makeClient();
  return _client;
}

export function getKwDatasetBucket(): string {
  return process.env.NIS_S3_BUCKET_KW_DATASETS ?? "nis-kw-datasets";
}

/**
 * S3 の NoSuchBucket / NotFound 系エラー検知
 */
export function isBucketNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  if (anyErr.name === "NoSuchBucket") return true;
  if (anyErr.Code === "NoSuchBucket") return true;
  if (anyErr.$metadata?.httpStatusCode === 404) return true;
  return false;
}

export function isObjectNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  if (anyErr.name === "NoSuchKey") return true;
  if (anyErr.Code === "NoSuchKey") return true;
  if (anyErr.$metadata?.httpStatusCode === 404) return true;
  return false;
}
