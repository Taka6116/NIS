"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InsightIssue } from "@/types/nis";

type Provider = "gemini" | "claude";

type EditableIssue = InsightIssue & { adopted: boolean };
type Stage3Response = { status?: string; error?: string; detail?: string; hypothesisCount?: number };
type Stage4Response = {
  status?: string;
  error?: string;
  detail?: string;
  insightId?: string;
  encodedInsightId?: string;
  redirectUrl?: string;
  actionCount?: number;
  hypothesisCount?: number;
};

type Step = "idle" | "stage3" | "stage4" | "done";

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
  const [items, setItems] = useState<EditableIssue[]>(
    issues.map((i) => ({ ...i, adopted: true })),
  );
  const [provider, setProvider] = useState<Provider>(modelProvider);
  const [step, setStep] = useState<Step>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const pending = step === "stage3" || step === "stage4";
  const adoptedCount = useMemo(() => items.filter((i) => i.adopted).length, [items]);

  const patch = (idx: number, next: Partial<EditableIssue>) => {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...next } : it)));
  };

  const baseUrl = `/api/projects/${projectId}/insights/drafts/${encodeURIComponent(draftId)}/finalize`;

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

    // ── Step A: Stage3（仮説生成）
    setStep("stage3");
    try {
      const res3 = await fetch(`${baseUrl}/stage3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, editedIssues: adopted }),
      });
      const text3 = await res3.text();
      let json3: Stage3Response | null = null;
      try { json3 = text3 ? (JSON.parse(text3) as Stage3Response) : null; } catch { json3 = null; }
      if (!res3.ok) {
        const detail = json3?.detail ? `\n${json3.detail}` : "";
        setErr(json3?.error ? `[仮説生成] ${json3.error}${detail}` : `仮説生成に失敗しました。(HTTP ${res3.status})`);
        setStep("idle");
        return;
      }
    } catch (e) {
      setErr(e instanceof Error ? `[仮説生成] ${e.message}` : "仮説生成に失敗しました。");
      setStep("idle");
      return;
    }

    // ── Step B: Stage4（打ち手生成）
    setStep("stage4");
    try {
      const res4 = await fetch(`${baseUrl}/stage4`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const text4 = await res4.text();
      let json4: Stage4Response | null = null;
      try { json4 = text4 ? (JSON.parse(text4) as Stage4Response) : null; } catch { json4 = null; }
      if (!res4.ok) {
        const detail = json4?.detail ? `\n${json4.detail}` : "";
        setErr(json4?.error ? `[打ち手生成] ${json4.error}${detail}` : `打ち手生成に失敗しました。(HTTP ${res4.status})`);
        setStep("idle");
        return;
      }
      const redirectUrl =
        json4?.redirectUrl ??
        (json4?.encodedInsightId || json4?.insightId
          ? `/projects/${projectId}/insights/${json4.encodedInsightId ?? json4.insightId}`
          : null);
      if (!redirectUrl) {
        setErr("生成は完了しましたが、遷移先 ID が API から返りませんでした。");
        setStep("idle");
        return;
      }
      const actionCount = typeof json4?.actionCount === "number" ? json4.actionCount : undefined;
      const hypothesisCount = typeof json4?.hypothesisCount === "number" ? json4.hypothesisCount : undefined;
      const countText =
        actionCount !== undefined && hypothesisCount !== undefined
          ? `（仮説 ${hypothesisCount} 件 / 打ち手 ${actionCount} 件）`
          : "";
      setMsg(`分析が完了しました。詳細画面に遷移します。${countText}`);
      setStep("done");
      window.location.assign(redirectUrl);
    } catch (e) {
      setErr(e instanceof Error ? `[打ち手生成] ${e.message}` : "打ち手生成に失敗しました。");
      setStep("idle");
    }
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
            {step === "stage3" ? "仮説を生成中… (1/2)" : step === "stage4" ? "打ち手を生成中… (2/2)" : "打ち手を生成 →"}
          </Button>
        </div>
        {pending ? (
          <div className="mt-3 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full animate-pulse rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-500"
                style={{ width: step === "stage3" ? "40%" : "80%" }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {step === "stage3"
                ? "Stage 3: 仮説・示唆を生成しています…"
                : "Stage 4: 打ち手・アクションを生成しています…"}
            </p>
          </div>
        ) : null}
        {err ? <p className="mt-3 text-sm text-rose-300">{err}</p> : null}
        {msg ? <p className="mt-3 text-sm text-emerald-300">{msg}</p> : null}
      </Card>
    </div>
  );
}
