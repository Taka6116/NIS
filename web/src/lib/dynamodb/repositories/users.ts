import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoClient, isMockDatabase } from "@/lib/dynamodb/client";
import { mockStore } from "@/lib/dynamodb/mock-store";
import { tableNames } from "@/lib/dynamodb/tables";
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

export function resolveRoleForEmail(email: string | null | undefined): UserRole {
  if (!email) return "viewer";
  if (adminEmails().has(email.toLowerCase())) return "admin";
  return "member";
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  if (isMockDatabase()) {
    return [...mockStore.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const out = await getDynamoClient().send(
    new ScanCommand({
      TableName: tableNames.users,
      FilterExpression: "email = :e",
      ExpressionAttributeValues: { ":e": email },
      Limit: 1,
    }),
  );
  const item = out.Items?.[0] as UserRecord | undefined;
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
  const out = await getDynamoClient().send(new ScanCommand({ TableName: tableNames.users }));
  return (out.Items ?? []) as UserRecord[];
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
