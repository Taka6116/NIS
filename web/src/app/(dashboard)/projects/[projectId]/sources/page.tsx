import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SourcesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Sources"
        subtitle="各データソースの接続状態と最終同期のサマリーです。"
        userEmail={session?.user?.email}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs font-semibold text-slate-400">Google Analytics 4</div>
          <div className="mt-2 text-lg font-semibold text-white">Property {project.ga4PropertyId}</div>
          <div className="mt-2">
            <Badge tone={project.lastGa4SyncAt ? "success" : "warning"}>
              {project.lastGa4SyncAt ? "CONNECTED" : "PENDING"}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-slate-500">Last sync: {project.lastGa4SyncAt ?? "—"}</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold text-slate-400">Search Console</div>
          <div className="mt-2 break-all text-sm text-slate-200">{project.gscPropertyUrl}</div>
          <div className="mt-2">
            <Badge tone={project.lastGscSyncAt ? "success" : "warning"}>
              {project.lastGscSyncAt ? "CONNECTED" : "PENDING"}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-slate-500">Last sync: {project.lastGscSyncAt ?? "—"}</p>
        </Card>
        <Card>
          <div className="text-xs font-semibold text-slate-400">Microsoft Clarity</div>
          <div className="mt-2 text-lg font-semibold text-white">
            {project.clarityProjectId ?? "未設定"}
          </div>
          <div className="mt-2">
            <Badge tone={project.clarityProjectId ? "success" : "danger"}>
              {project.clarityProjectId ? "CONNECTED" : "RE-AUTH REQUIRED"}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-slate-500">Last sync: {project.lastClaritySyncAt ?? "—"}</p>
        </Card>
      </div>
      <Card className="mt-6">
        <Link href={`/projects/${projectId}/settings`} className="text-sm text-cyan-300 hover:text-cyan-200">
          Settings でトークンとプロパティを更新 →
        </Link>
      </Card>
    </main>
  );
}
