import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { notFound } from "next/navigation";

export default async function ReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Reports"
        subtitle={`${project.projectName} — エクスポート / PDF / 共有は Phase 3 で拡張予定です。`}
        userEmail={session?.user?.email}
      />
      <Card className="mt-8">
        <p className="text-sm text-slate-300">
          レポート機能はプレースホルダです。週次インサイト JSON とメトリクス API をベースに、印刷テンプレおよび共有リンクを追加できます。
        </p>
      </Card>
    </main>
  );
}
