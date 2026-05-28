import type { BatchWriteCommandInput, QueryCommandInput, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient } from "@/lib/dynamodb/client";

/**
 * BatchWriteCommand の UnprocessedItems を指数バックオフで再試行する。
 * DynamoDB は1バッチ25件上限、かつスロットリングが発生すると UnprocessedItems を返す。
 */
export async function batchWriteWithRetry(
  input: BatchWriteCommandInput,
  maxRetries = 5,
): Promise<void> {
  const client = getDynamoClient();
  let requestItems = input.RequestItems;
  let attempt = 0;

  while (requestItems && Object.keys(requestItems).length > 0) {
    const res = await client.send(new BatchWriteCommand({ RequestItems: requestItems }));
    const unprocessed = res.UnprocessedItems;

    if (!unprocessed || Object.keys(unprocessed).length === 0) {
      return;
    }

    attempt++;
    if (attempt >= maxRetries) {
      const itemCount = Object.values(unprocessed).reduce((s, v) => s + v.length, 0);
      throw new Error(
        `DynamoDB BatchWrite: ${itemCount} item(s) unprocessed after ${maxRetries} retries.`,
      );
    }

    // 指数バックオフ: 100ms, 200ms, 400ms, 800ms, …
    await new Promise((r) => setTimeout(r, 100 * 2 ** (attempt - 1)));
    requestItems = unprocessed;
  }
}

/**
 * QueryCommand の LastEvaluatedKey を処理して全ページを取得する汎用ヘルパー。
 */
export async function queryAllPages<T>(params: QueryCommandInput): Promise<T[]> {
  const client = getDynamoClient();
  const out: T[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await client.send(
      new QueryCommand({ ...params, ExclusiveStartKey: lastKey }),
    );
    for (const item of res.Items ?? []) {
      out.push(item as T);
    }
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return out;
}

/**
 * ScanCommand の LastEvaluatedKey を処理して全ページを取得する汎用ヘルパー。
 * 大規模テーブルには GSI を設計すること（後方互換用）。
 */
export async function scanAllPages<T>(params: ScanCommandInput): Promise<T[]> {
  const client = getDynamoClient();
  const out: T[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await client.send(
      new ScanCommand({ ...params, ExclusiveStartKey: lastKey }),
    );
    for (const item of res.Items ?? []) {
      out.push(item as T);
    }
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return out;
}

/**
 * Email で DynamoDB users テーブルを検索する。
 * EmailIndex GSI がある場合は Query（効率的）、ない場合は全件 Scan にフォールバック。
 *
 * 本番では GSI（EmailIndex: pk=email）の作成を強く推奨。
 */
export async function queryUsersByEmail(
  usersTable: string,
  email: string,
): Promise<unknown[]> {
  const client = getDynamoClient();
  try {
    const res = await client.send(
      new QueryCommand({
        TableName: usersTable,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email },
        Limit: 1,
      }),
    );
    return res.Items ?? [];
  } catch (err) {
    // GSI が存在しない場合は Scan にフォールバック
    const e = err as { name?: string; message?: string };
    if (
      e.name === "ValidationException" ||
      (typeof e.message === "string" && e.message.toLowerCase().includes("index"))
    ) {
      return scanAllPages({
        TableName: usersTable,
        FilterExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email },
      });
    }
    throw err;
  }
}
