"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InsightIssue } from "@/types/nis";

type Provider = "gemini" | "claude";

type EditableIssue = InsightIssue & { adopted: boolean };

export function DraftReviewForm({
  projectId,
  draftId,
  issues,
  modelProvider,
}: {
  projectId: string;
  draftId: string;
  issues: InsightIssue[];
  modelProvider: Provider;
}) {
  const router = useRouter();
  const [items, setItems] = useState<EditableIssue[]>(
    issues.map((i) => ({ ...i, adopted: true })),
  );
  const [provider, setProvider] = useState<Provider>(modelProvider);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const adoptedCount = useMemo(() => items.filter((i) => i.adopted).length, [items]);

  const patch = (idx: number, next: Partial<EditableIssue>) => {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...next } : it)));
  };

  const submit = async () => {
    setErr(null);
    setMsg(null);
    const adopted: InsightIssue[] = items
      .filter((i) => i.adopted)
      .map((i) => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        description: i.description,
        relatedFactIds: i.relatedFactIds,
        category: i.category,
      }));
    if (adopted.length === 0) {
      setErr("採用する課題を 1 件以上選んでください。");
      return;
    }
    setPending(true);
    const res = await fetch(
      `/api/projects/${projectId}/insights/drafts/${encodeURIComponent(draftId)}/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, editedIssues: adopted }),
      },
    );
    setPending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setErr(j?.error ?? "示唆・仮説と打ち手の生成に失敗しました。");
      return;
    }
    const j = (await res.json()) as { insightId?: string };
    setMsg("分析が完了しました。詳細画面に遷移します。");
    if (j.insightId) router.push(`/projects/${projectId}/insights/${j.insightId}`);
  };

  return (
    <div className="mt-6 space-y-4">
      <Card className="glow-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Stage 2 — Issues（編集可能）
            </div>
            <p className="mt-1 text-xs text-slate-500">
              採用する課題を選び、重要度・カテゴリ・説明文を必要に応じて修正してください。
            </p>
          </div>
          <Badge tone="success" className="normal-case">
            採用 {adoptedCount} / {items.length}
          </Badge>
        </div>
      </Card>

      <div className="space-y-3">
        {items.map((i, idx) => (
          <Card
            key={i.id}
            className={
              i.adopted
                ? "border-emerald-400/30 ring-1 ring-emerald-400/20"
                : "border-white/5 bg-card/50 opacity-60"
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{i.id}</span>
                <select
                  value={i.category}
                  onChange={(e) => patch(idx, { category: e.target.value as InsightIssue["category"] })}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="seo">seo</option>
                  <option value="traffic">traffic</option>
                  <option value="ux">ux</option>
                  <option value="conversion">conversion</option>
                </select>
                <select
                  value={i.severity}
                  onChange={(e) => patch(idx, { severity: e.target.value as InsightIssue["severity"] })}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200"
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={i.adopted}
                  onChange={(e) => patch(idx, { adopted: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20 bg-black/30"
                />
                採用する
              </label>
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">タイトル</Label>
                <Input
                  value={i.title}
                  disabled={!i.adopted}
                  onChange={(e) => patch(idx, { title: e.target.value })}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">説明</Label>
                <textarea
                  value={i.description}
                  disabled={!i.adopted}
                  onChange={(e) => patch(idx, { description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-60"
                />
              </div>
              {i.relatedFactIds.length > 0 ? (
                <p className="text-xs text-slate-500">関連 fact: {i.relatedFactIds.join(", ")}</p>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Card className="glow-border">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Step 3 に使う LLM</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-slate-200"
            >
              <option value="gemini">Gemini</option>
              <option value="claude">Claude (Bedrock)</option>
            </select>
          </div>
          <Button onClick={submit} disabled={pending} className="rounded-xl">
            {pending ? "示唆・打ち手を生成中…" : "打ち手を生成 →"}
          </Button>
        </div>
        {pending ? (
          <div className="mt-3 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              Stage 3 Hypotheses → Stage 4 Actions を実行中です。
            </p>
          </div>
        ) : null}
        {err ? <p className="mt-3 text-sm text-rose-300">{err}</p> : null}
        {msg ? <p className="mt-3 text-sm text-emerald-300">{msg}</p> : null}
      </Card>
    </div>
  );
}
