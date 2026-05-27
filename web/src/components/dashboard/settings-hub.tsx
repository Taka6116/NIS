"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useState } from "react";
import type { ProjectRecord } from "@/types/nis";

function statusBadge(last?: string) {
  if (!last) return <Badge tone="warning">未同期</Badge>;
  const age = Date.now() - new Date(last).getTime();
  if (age > 1000 * 60 * 60 * 48) return <Badge tone="warning">要確認</Badge>;
  return <Badge tone="success">接続済</Badge>;
}

export function SettingsHub({
  project,
  canEdit,
}: {
  project: ProjectRecord;
  canEdit: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      gscPropertyUrl: String(fd.get("gscPropertyUrl") ?? ""),
      ga4PropertyId: String(fd.get("ga4PropertyId") ?? ""),
      clarityProjectId: String(fd.get("clarityProjectId") ?? "") || undefined,
      clarityApiTokenEncrypted: String(fd.get("clarityToken") ?? "") || undefined,
    };
    const res = await fetch(`/api/projects/${project.projectId}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) setMessage("保存に失敗しました。");
    else setMessage("設定を保存しました。同期を実行してデータを取り込んでください。");
  }

  async function onSync() {
    setSyncPending(true);
    setMessage(null);
    const res = await fetch(`/api/projects/${project.projectId}/sync`, { method: "POST" });
    setSyncPending(false);
    if (!res.ok) setMessage("同期に失敗しました。Service Account とプロパティ ID を確認してください。");
    else setMessage("同期ジョブが完了しました。");
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-white">アクティブデータ連携</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-200">Google Analytics 4</span>
              {statusBadge(project.lastGa4SyncAt)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-200">Search Console</span>
              {statusBadge(project.lastGscSyncAt)}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-200">Microsoft Clarity</span>
              {project.clarityProjectId ? statusBadge(project.lastClaritySyncAt) : <Badge tone="danger">未設定</Badge>}
            </div>
            <div className="text-xs text-slate-500">
              最終同期: {project.lastSyncAt ? new Date(project.lastSyncAt).toLocaleString("ja-JP") : "—"}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-white">パイプライン</h2>
          <p className="mt-1 text-xs text-slate-500">本番は日次バッチ（Vercel Cron）を前提にしています。</p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <div>
              <div className="text-sm text-slate-200">日次同期</div>
              <div className="text-xs text-slate-500">毎日 06:00 JST 相当（UTC 調整済み Cron）</div>
            </div>
            <Badge tone="neutral">常時 ON</Badge>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-500">リソース負荷（モック表示）</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onSync}
              disabled={syncPending || pending || !canEdit}
              className="min-w-[7rem]"
            >
              {syncPending ? (
                <>
                  <LoadingSpinner variant="ring" size="sm" />
                  同期中…
                </>
              ) : (
                "今すぐ同期"
              )}
            </Button>
            <Button type="button" variant="outline" disabled>
              データログ（準備中）
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-white">認証情報</h2>
        <p className="mt-1 text-xs text-slate-500">
          Service Account JSON は原則としてサーバー環境変数 <code className="text-cyan-200">GOOGLE_SERVICE_ACCOUNT_JSON</code>{" "}
          に配置してください。DynamoDB への平文保存は避け、本フォームはプロパティ情報のみを更新します。
        </p>
        <form onSubmit={onSave} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="gscPropertyUrl">Search Console プロパティ URL</Label>
            <Input
              id="gscPropertyUrl"
              name="gscPropertyUrl"
              defaultValue={project.gscPropertyUrl}
              disabled={!canEdit}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
            <Input id="ga4PropertyId" name="ga4PropertyId" defaultValue={project.ga4PropertyId} disabled={!canEdit} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clarityProjectId">Clarity Project ID</Label>
            <Input
              id="clarityProjectId"
              name="clarityProjectId"
              defaultValue={project.clarityProjectId ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clarityToken">Clarity API Token（JWT）</Label>
            <Input
              id="clarityToken"
              name="clarityToken"
              type="password"
              autoComplete="off"
              placeholder="••••••••••••"
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={!canEdit || pending || syncPending} className="min-w-[9rem]">
              {pending ? (
                <>
                  <LoadingSpinner variant="ring" size="sm" />
                  保存中…
                </>
              ) : (
                "Validate & Save"
              )}
            </Button>
          </div>
        </form>
        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
