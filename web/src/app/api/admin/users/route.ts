import { listUsers } from "@/lib/dynamodb/repositories/users";
import { requireAdmin, isAuthError } from "@/lib/rbac";

export async function GET() {
  try { await requireAdmin(); } catch (e) {
    if (isAuthError(e)) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const users = await listUsers();
  return Response.json({ users });
}
