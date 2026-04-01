import { AppHeader } from "@/components/layout/app-header";
import { SettingsHub } from "@/components/dashboard/settings-hub";
import { LogoutButton } from "./logout-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { getSessionUserRole } from "@/lib/rbac";
import { listUsers } from "@/lib/dynamodb/repositories/users";
import { notFound } from "next/navigation";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();
  const meta = await getSessionUserRole();
  const canEdit = meta?.role === "admin" || meta?.role === "member";
  const users = meta?.role === "admin" ? await listUsers() : [];

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Settings & Intelligence hub"
        subtitle="データ接続、同期、オペレーター権限をまとめて管理します。"
        userEmail={session?.user?.email}
      />
      <SettingsHub project={project} canEdit={canEdit} />
      {meta?.role === "admin" ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">コラボレーションアクセス</h2>
            <Button variant="outline" className="text-xs uppercase" disabled>
              + Invite operator
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Operator</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr key={u.userId} className="text-slate-200">
                    <td className="py-3">
                      <div className="font-medium">{u.name ?? u.email}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3">
                      <Badge tone="ai" className="normal-case">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 text-emerald-300">{u.status ?? "active"}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-slate-500">
                      まだユーザーレコードがありません。Google ログイン後に自動作成されます。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mt-6 border-rose-400/15 bg-rose-500/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">ログアウト</h2>
            <p className="mt-1 text-xs text-slate-500">
              現在 <span className="text-slate-300">{session?.user?.email ?? "—"}</span> でログイン中
            </p>
          </div>
          <LogoutButton />
        </div>
      </Card>
    </main>
  );
}
