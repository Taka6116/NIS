import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { ProjectAlertConfig } from "@/types/nis";

export async function getProjectAlertConfig(projectId: string): Promise<ProjectAlertConfig | null> {
  if (isMockDatabase()) {
    return mockStore.projectAlerts.get(projectId) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({
      TableName: tableNames.projectAlerts,
      Key: { projectId, sk: "config" },
    }),
  );
  return (out.Item as ProjectAlertConfig | undefined) ?? null;
}

export async function putProjectAlertConfig(row: ProjectAlertConfig): Promise<void> {
  if (isMockDatabase()) {
    mockStore.projectAlerts.set(row.projectId, row);
    return;
  }
  await getDynamoClient().send(
    new PutCommand({ TableName: tableNames.projectAlerts, Item: row }),
  );
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
