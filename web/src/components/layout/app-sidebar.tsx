"use client";

import { cn } from "@/lib/utils";
import {
  FolderKanban,
  LayoutDashboard,
  Plug,
  FileBarChart,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const items = (projectId: string) =>
  [
    { href: "/", label: "Projects", icon: FolderKanban, match: (p: string) => p === "/" },
    {
      href: `/projects/${projectId}`,
      label: "Intelligence",
      icon: LayoutDashboard,
      match: (p: string) =>
        p === `/projects/${projectId}` || p.startsWith(`/projects/${projectId}/insights`),
    },
    {
      href: `/projects/${projectId}/reports`,
      label: "Reports",
      icon: FileBarChart,
      match: (p: string) => p.startsWith(`/projects/${projectId}/reports`),
    },
    {
      href: `/projects/${projectId}/sources`,
      label: "Sources",
      icon: Plug,
      match: (p: string) => p.startsWith(`/projects/${projectId}/sources`),
    },
    {
      href: `/projects/${projectId}/settings`,
      label: "Settings",
      icon: Settings,
      match: (p: string) => p.startsWith(`/projects/${projectId}/settings`),
    },
  ] as const;

export function AppSidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname();
  const nav = projectId
    ? items(projectId)
    : [{ href: "/", label: "Projects", icon: FolderKanban, match: (p: string) => p === "/" }];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0f141d]/95 py-6 pl-4 pr-3 backdrop-blur-md">
      <div className="mb-8 px-2">
        <div className="text-xl font-bold tracking-tight text-white">NIS</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Nihon Insight System</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/25"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
              )}
            >
              <Icon className="size-4 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {projectId ? (
        <div className="mt-4 pr-1">
          <Link href={`/projects/${projectId}/insights/generate`} className="block">
            <Button className="w-full gap-2 rounded-xl py-3 text-xs font-semibold uppercase tracking-wide">
              <Sparkles className="size-4" />
              New Analysis
            </Button>
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
