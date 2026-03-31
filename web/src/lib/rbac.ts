import { auth } from "@/auth";
import { getUserByEmail, resolveRoleForEmail } from "@/lib/dynamodb/repositories/users";
import type { UserRole } from "@/types/nis";

export async function getSessionUserRole(): Promise<{ email: string; role: UserRole } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const row = await getUserByEmail(email);
  const role = row?.role ?? resolveRoleForEmail(email);
  return { email, role };
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

export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError;
}
