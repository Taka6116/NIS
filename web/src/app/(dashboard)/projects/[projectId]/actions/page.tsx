import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { ActionKanban } from "@/components/insights/action-kanban";
import { auth } from "@/auth";
import { listInsights } from "@/lib/dynamodb/repositories/insights";
import { listActionTracking } from "@/lib/dynamodb/repositories/action-tracking";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { notFound } from "next/navigation";

export default async function ActionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();

  const [insights, rows] = await Promise.all([
    listInsights(projectId, 10),
    listActionTracking(projectId),
  ]);

  const seeds = insights.flatMap((ins) => {
    const actions = ins.pipeline?.actions ?? [];
    const issues = ins.pipeline?.issues ?? [];
    return actions.map((a) => ({
      insightSk: ins.sk,
      actionId: a.id,
      title: a.title,
      issueTitle: issues.find((i) => i.id === a.issueId)?.title,
      priority: a.priority,
      generatedAtIso: ins.generatedAtIso,
      iceScore:
        a.ice && typeof a.ice.impact === "number" && typeof a.ice.confidence === "number" && typeof a.ice.ease === "number"
          ? (a.ice.impact + a.ice.confidence + a.ice.ease) / 3
          : undefined,
    }));
  });

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="打ち手トラッキング"
        subtitle={`${project.projectName} — 最新 10 件のインサイトから抽出した打ち手を Kanban 形式で管理`}
        userEmail={session?.user?.email}
      />
      <div className="mt-6">
        {seeds.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-300">
              打ち手がまだありません。インサイトを生成してください。
            </p>
          </Card>
        ) : (
          <ActionKanban projectId={projectId} seeds={seeds} initialRows={rows} />
        )}
      </div>
    </main>
  );
}
