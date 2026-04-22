import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function isMockDatabase(): boolean {
  return process.env.NIS_USE_MOCK_DB === "1" || process.env.NIS_USE_MOCK_DB === "true";
}

function makeClient(): DynamoDBDocumentClient {
  const region = process.env.AWS_REGION ?? "ap-northeast-1";
  const raw = new DynamoDBClient({
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
  return DynamoDBDocumentClient.from(raw, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

let _client: DynamoDBDocumentClient | null = null;

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!_client) _client = makeClient();
  return _client;
}

/** @deprecated Use getDynamoClient() — kept for backward compatibility */
export const dynamoClient = isMockDatabase() ? (null as unknown as DynamoDBDocumentClient) : makeClient();

/**
 * DynamoDB の ResourceNotFoundException（テーブル未作成）を検出するための型ガード。
 * 新規機能で追加したテーブルが本番にまだ存在しないケースを、
 * 「空の状態」として扱うための判定に使います。
 */
export function isTableNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  if (anyErr.name === "ResourceNotFoundException") return true;
  if (anyErr.message && anyErr.message.includes("ResourceNotFoundException")) return true;
  return false;
}
