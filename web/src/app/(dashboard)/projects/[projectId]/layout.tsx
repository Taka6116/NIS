import { AppSidebar } from "@/components/layout/app-sidebar";
import { ensureDefaultProject } from "@/lib/dynamodb/repositories/projects";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await ensureDefaultProject();
  return (
    <div className="flex min-h-screen">
      <AppSidebar projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
