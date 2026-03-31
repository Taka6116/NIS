import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { listUsers } from "@/lib/dynamodb/repositories/users";
import { getSessionUserRole } from "@/lib/rbac";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await auth();
  const meta = await getSessionUserRole();
  if (!meta || meta.role !== "admin") {
    redirect("/");
  }
  const users = await listUsers();

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-8">
        <AppHeader title="Admin — users" subtitle="DynamoDB `nis-users` テーブルのスナップショット" userEmail={session?.user?.email} />
        <Card className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">User</th>
                <th className="py-2">Role</th>
                <th className="py-2">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="py-3 text-slate-100">
                    <div className="font-medium">{u.name ?? u.email}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3">
                    <Badge tone="ai" className="normal-case">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 text-xs text-slate-400">{(u.projectIds ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
