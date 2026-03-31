import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import type { ProjectRecord } from "@/types/nis";

function nowIso() {
  return new Date().toISOString();
}

export async function listProjects(): Promise<ProjectRecord[]> {
  if (isMockDatabase()) {
    return [...mockStore.projects.values()].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
  }
  const out = await getDynamoClient().send(
    new ScanCommand({
      TableName: tableNames.projects,
      ProjectionExpression:
        "projectId, projectName, #d, gscPropertyUrl, ga4PropertyId, clarityProjectId, lastSyncAt, lastGscSyncAt, lastGa4SyncAt, lastClaritySyncAt, createdAt, updatedAt",
      ExpressionAttributeNames: { "#d": "domain" },
    }),
  );
  const items = (out.Items ?? []) as ProjectRecord[];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  if (isMockDatabase()) {
    return mockStore.projects.get(projectId) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({
      TableName: tableNames.projects,
      Key: { projectId },
    }),
  );
  return (out.Item as ProjectRecord | undefined) ?? null;
}

export type CreateProjectInput = {
  projectName: string;
  domain: string;
  gscPropertyUrl: string;
  ga4PropertyId: string;
  clarityProjectId?: string;
};

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const projectId = uuid();
  const row: ProjectRecord = {
    projectId,
    projectName: input.projectName,
    domain: input.domain,
    gscPropertyUrl: input.gscPropertyUrl,
    ga4PropertyId: input.ga4PropertyId,
    clarityProjectId: input.clarityProjectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  if (isMockDatabase()) {
    mockStore.projects.set(projectId, row);
    return row;
  }
  await getDynamoClient().send(
    new PutCommand({
      TableName: tableNames.projects,
      Item: row,
    }),
  );
  return row;
}

export async function updateProjectSyncMeta(
  projectId: string,
  partial: Partial<Pick<ProjectRecord, "lastSyncAt" | "lastGscSyncAt" | "lastGa4SyncAt" | "lastClaritySyncAt">>,
): Promise<void> {
  const updatedAt = nowIso();
  if (isMockDatabase()) {
    const cur = mockStore.projects.get(projectId);
    if (!cur) return;
    mockStore.projects.set(projectId, { ...cur, ...partial, updatedAt });
    return;
  }
  const names: Record<string, string> = { "#u": "updatedAt" };
  const values: Record<string, unknown> = { ":u": updatedAt };
  const sets = ["#u = :u"];
  let i = 0;
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue;
    const nk = `#f${i}`;
    const vk = `:v${i}`;
    names[nk] = k;
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
    i++;
  }
  await getDynamoClient().send(
    new UpdateCommand({
      TableName: tableNames.projects,
      Key: { projectId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function updateProjectCredentials(
  projectId: string,
  patch: Partial<
    Pick<
      ProjectRecord,
      | "projectName"
      | "domain"
      | "clarityProjectId"
      | "clarityApiTokenEncrypted"
      | "gscPropertyUrl"
      | "ga4PropertyId"
      | "googleServiceSecretRef"
    >
  >,
): Promise<void> {
  const updatedAt = nowIso();
  if (isMockDatabase()) {
    const cur = mockStore.projects.get(projectId);
    if (!cur) return;
    mockStore.projects.set(projectId, { ...cur, ...patch, updatedAt });
    return;
  }
  const names: Record<string, string> = { "#u": "updatedAt" };
  const values: Record<string, unknown> = { ":u": updatedAt };
  const sets = ["#u = :u"];
  let idx = 0;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const nk = `#p${idx}`;
    const vk = `:p${idx}`;
    names[nk] = k;
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
    idx++;
  }
  await getDynamoClient().send(
    new UpdateCommand({
      TableName: tableNames.projects,
      Key: { projectId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

/** シングルテナント時、環境変数の既定値と DB 上のプロジェクトを揃える */
async function reconcileSingleTenantProjectFromEnv(existing: ProjectRecord[]): Promise<void> {
  const projectName = process.env.NIS_DEFAULT_PROJECT_NAME;
  const domain = process.env.NIS_DEFAULT_DOMAIN;
  const gscPropertyUrl = process.env.NIS_DEFAULT_GSC_PROPERTY_URL;
  const ga4PropertyId = process.env.NIS_DEFAULT_GA4_PROPERTY_ID;
  const clarityProjectId = process.env.NIS_DEFAULT_CLARITY_PROJECT_ID;
  if (!projectName || !domain) return;
  if (existing.length !== 1) return;

  const p = existing[0];
  const patch: Partial<
    Pick<
      ProjectRecord,
      "projectName" | "domain" | "gscPropertyUrl" | "ga4PropertyId" | "clarityProjectId"
    >
  > = {};
  if (gscPropertyUrl && gscPropertyUrl !== p.gscPropertyUrl) patch.gscPropertyUrl = gscPropertyUrl;
  if (ga4PropertyId && ga4PropertyId !== p.ga4PropertyId) patch.ga4PropertyId = ga4PropertyId;
  if (domain !== p.domain) patch.domain = domain;
  if (projectName !== p.projectName) patch.projectName = projectName;
  if (clarityProjectId && clarityProjectId !== p.clarityProjectId) {
    patch.clarityProjectId = clarityProjectId;
  }
  if (Object.keys(patch).length > 0) await updateProjectCredentials(p.projectId, patch);
}

export async function ensureDefaultProject(): Promise<ProjectRecord | null> {
  const defaults = {
    projectName: process.env.NIS_DEFAULT_PROJECT_NAME,
    domain: process.env.NIS_DEFAULT_DOMAIN,
    gscPropertyUrl: process.env.NIS_DEFAULT_GSC_PROPERTY_URL,
    ga4PropertyId: process.env.NIS_DEFAULT_GA4_PROPERTY_ID,
  };
  if (!defaults.projectName || !defaults.domain) return null;

  const existing = await listProjects();
  if (existing.length > 0) {
    await reconcileSingleTenantProjectFromEnv(existing);
    return (await getProject(existing[0].projectId)) ?? existing[0];
  }

  return createProject({
    projectName: defaults.projectName,
    domain: defaults.domain,
    gscPropertyUrl: defaults.gscPropertyUrl ?? "",
    ga4PropertyId: defaults.ga4PropertyId ?? "",
    clarityProjectId: process.env.NIS_DEFAULT_CLARITY_PROJECT_ID,
  });
}
