import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className="flex min-h-screen">
      <AppSidebar projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
