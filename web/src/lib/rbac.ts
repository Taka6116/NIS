import { auth } from "@/auth";
import { getUserByEmail, resolveRoleForEmail } from "@/lib/dynamodb/repositories/users";
import type { UserRole } from "@/types/nis";

export async function getSessionUserRole(): Promise<{ email: string; role: UserRole; projectIds: string[] } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const row = await getUserByEmail(email);
  const role = row?.role ?? resolveRoleForEmail(email);
  return { email, role, projectIds: row?.projectIds ?? [] };
}

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const meta = await getSessionUserRole();
  if (!meta || meta.role !== "admin") {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

/**
 * プロジェクトへのアクセス権を確認する。
 * admin は全プロジェクトにアクセス可。
 * member は自分の projectIds に含まれる場合のみ許可。
 * viewer は常に拒否。
 * allowedRoles を指定すると、そのロール以上のみ許可する。
 */
export async function requireProjectAccess(
  projectId: string,
  allowedRoles: UserRole[] = ["member", "admin"],
): Promise<{ email: string; role: UserRole }> {
  await requireSession();
  const meta = await getSessionUserRole();
  if (!meta) throw new AuthError("Unauthorized", 401);
  const { role, projectIds } = meta;

  if (!allowedRoles.includes(role)) {
    throw new AuthError("Forbidden: insufficient role", 403);
  }
  if (role === "admin") {
    return { email: meta.email, role };
  }
  if (!projectIds.includes(projectId)) {
    throw new AuthError("Forbidden: no access to this project", 403);
  }
  return { email: meta.email, role };
}

export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError;
}
