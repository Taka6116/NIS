"use client";

import { Bell, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOut } from "next-auth/react";

type Tab = { id: string; label: string; href: string };

export function AppHeader({
  title,
  subtitle,
  tabs,
  activeTabId,
  executeHref,
  userEmail,
}: {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTabId?: string;
  executeHref?: string;
  userEmail?: string | null;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success" className="gap-2 normal-case">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            System optimized
          </Badge>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
            aria-label="Quick actions"
          >
            <Zap className="size-4" />
          </button>
          <div className="hidden text-right text-xs text-slate-400 sm:block">
            <div className="font-medium text-slate-200">{userEmail ?? "—"}</div>
            <button type="button" className="hover:text-cyan-300" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sign out
            </button>
          </div>
          {executeHref ? (
            <Link href={executeHref}>
              <Button className="rounded-xl px-5 text-xs font-bold uppercase tracking-widest">Execute report</Button>
            </Link>
          ) : null}
        </div>
      </div>
      {tabs?.length ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = t.id === activeTabId;
            return (
              <Link
                key={t.id}
                href={t.href}
                className={
                  active
                    ? "rounded-full bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/30"
                    : "rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
