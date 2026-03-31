import { auth } from "@/auth";
import { listProjects, ensureDefaultProject } from "@/lib/dynamodb/repositories/projects";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ProjectCreateForm } from "@/components/dashboard/project-create-form";
import { Card } from "@/components/ui/card";

export default async function RootPage() {
  const session = await auth();

  await ensureDefaultProject();
  const projects = await listProjects();

  if (projects.length === 1) {
    redirect(`/projects/${projects[0].projectId}`);
  }

  if (projects.length > 1) {
    redirect(`/projects/${projects[0].projectId}`);
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 p-8">
        <AppHeader
          title="NIS"
          subtitle="プロジェクトを作成してください。"
          userEmail={session?.user?.email}
        />
        <div className="mt-8 max-w-xl">
          <Card>
            <h2 className="text-lg font-semibold text-white">新規プロジェクト</h2>
            <p className="mt-1 text-sm text-slate-400">
              環境変数 <code className="text-xs text-cyan-300">NIS_DEFAULT_PROJECT_NAME</code> と{" "}
              <code className="text-xs text-cyan-300">NIS_DEFAULT_DOMAIN</code> を設定すると自動作成されます。
            </p>
            <ProjectCreateForm />
          </Card>
        </div>
      </main>
    </div>
  );
}
