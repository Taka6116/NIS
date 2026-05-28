import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
import { queryUsersByEmail, scanAllPages } from "@/lib/dynamodb/helpers";
import type { UserRecord, UserRole } from "@/types/nis";

function adminEmails(): Set<string> {
  const raw = process.env.NIS_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * 新規 OAuth ユーザーのデフォルトロール。
 * admin メール以外は "viewer" にする。member 昇格は管理者が /admin/users で行う。
 */
export function resolveRoleForEmail(email: string | null | undefined): UserRole {
  if (!email) return "viewer";
  if (adminEmails().has(email.toLowerCase())) return "admin";
  return "viewer";
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  if (isMockDatabase()) {
    return (
      [...mockStore.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  }
  // Email GSI がある場合は Query、ない場合は全件 Scan にフォールバック。
  // 本番では EmailIndex（pk: email）GSI の作成を推奨。
  const items = await queryUsersByEmail(tableNames.users, email);
  const item = items[0] as UserRecord | undefined;
  return item ?? null;
}

export async function upsertUserFromOAuth(opts: {
  email: string;
  name?: string | null;
  sub: string;
}): Promise<UserRecord> {
  const existing = await getUserByEmail(opts.email);
  const role = existing?.role ?? resolveRoleForEmail(opts.email);
  const row: UserRecord = {
    userId: existing?.userId ?? opts.sub,
    email: opts.email,
    name: opts.name ?? existing?.name,
    role,
    projectIds: existing?.projectIds ?? [],
    status: "active",
  };
  if (isMockDatabase()) {
    mockStore.users.set(row.userId, row);
    return row;
  }
  await getDynamoClient().send(
    new PutCommand({
      TableName: tableNames.users,
      Item: row,
    }),
  );
  return row;
}

export async function listUsers(): Promise<UserRecord[]> {
  if (isMockDatabase()) {
    return [...mockStore.users.values()];
  }
  return scanAllPages<UserRecord>({ TableName: tableNames.users });
}

export async function getUser(userId: string): Promise<UserRecord | null> {
  if (isMockDatabase()) {
    return mockStore.users.get(userId) ?? null;
  }
  const out = await getDynamoClient().send(
    new GetCommand({ TableName: tableNames.users, Key: { userId } }),
  );
  return (out.Item as UserRecord | undefined) ?? null;
}
