import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase, isTableNotFoundError } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { ProjectAlertConfig } from "@/types/nis";

export async function getProjectAlertConfig(projectId: string): Promise<ProjectAlertConfig | null> {
  if (isMockDatabase()) {
    return mockStore.projectAlerts.get(projectId) ?? null;
  }
  try {
    const out = await getDynamoClient().send(
      new GetCommand({
        TableName: tableNames.projectAlerts,
        Key: { projectId, sk: "config" },
      }),
    );
    return (out.Item as ProjectAlertConfig | undefined) ?? null;
  } catch (e) {
    if (isTableNotFoundError(e)) {
      console.warn(
        `[project-alerts] table '${tableNames.projectAlerts}' not found; returning null`,
      );
      return null;
    }
    throw e;
  }
}

export async function putProjectAlertConfig(row: ProjectAlertConfig): Promise<void> {
  if (isMockDatabase()) {
    mockStore.projectAlerts.set(row.projectId, row);
    return;
  }
  try {
    await getDynamoClient().send(
      new PutCommand({ TableName: tableNames.projectAlerts, Item: row }),
    );
  } catch (e) {
    if (isTableNotFoundError(e)) {
      throw new Error(
        `DynamoDB テーブル '${tableNames.projectAlerts}' が存在しません。AWS コンソールでこのテーブルを作成してください（PK: projectId, SK: sk）。`,
      );
    }
    throw e;
  }
}

export function defaultAlertConfig(projectId: string): ProjectAlertConfig {
  return {
    projectId,
    sk: "config",
    enabled: false,
    rules: [
      {
        id: "r1",
        metric: "sessions",
        operator: "drop_pct",
        threshold: 20,
        window: "d7",
        severity: "high",
      },
      {
        id: "r2",
        metric: "clicks",
        operator: "drop_pct",
        threshold: 25,
        window: "d7",
        severity: "high",
      },
      {
        id: "r3",
        metric: "bounceRate",
        operator: "rise_pct",
        threshold: 10,
        window: "d7",
        severity: "medium",
      },
    ],
    autoTriggerDraft: false,
    updatedAtIso: new Date().toISOString(),
  };
}
