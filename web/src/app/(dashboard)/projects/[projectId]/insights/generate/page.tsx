"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

type Provider = "gemini" | "claude";
type Preset = "7d" | "28d" | "90d" | "MTD" | "QTD";
type Comparison = "previous" | "yoy";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function subDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function subYearsStr(s: string): string {
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfQuarter(): string {
  const d = new Date();
  const qMonth = Math.floor(d.getMonth() / 3) * 3;
  return `${d.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
}

function resolvePresetDates(preset: Preset): { start: string; end: string } {
  const end = todayStr();
  if (preset === "MTD") return { start: startOfMonth(), end };
  if (preset === "QTD") return { start: startOfQuarter(), end };
  const days = preset === "7d" ? 7 : preset === "28d" ? 28 : 90;
  return { start: subDaysStr(days - 1), end };
}

function daysInclusive(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

function computePrev(start: string, end: string, comparison: Comparison): { prevStart: string; prevEnd: string } {
  if (comparison === "yoy") {
    return { prevStart: subYearsStr(start), prevEnd: subYearsStr(end) };
  }
  const n = daysInclusive(start, end);
  const s = new Date(`${start}T00:00:00Z`);
  const prevEnd = new Date(s.getTime() - 86_400_000);
  const prevStart = new Date(s.getTime() - n * 86_400_000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) };
}

const steps = [
  { id: 1, label: "期間選択" },
  { id: 2, label: "課題ドラフト" },
  { id: 3, label: "打ち手生成" },
] as const;

function StepIndicator({ active }: { active: 1 | 2 | 3 }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      {steps.map((s, idx) => (
        <div key={s.id} className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              active === s.id
                ? "bg-cyan-400/25 text-cyan-50 ring-2 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                : active > s.id
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                  : "bg-white/5 text-slate-400 ring-1 ring-white/10",
            )}
          >
            {s.id}
          </div>
          <span
            className={cn(
              "text-xs font-medium",
              active === s.id ? "text-cyan-100" : active > s.id ? "text-emerald-200" : "text-slate-500",
            )}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 ? <span className="h-px w-10 bg-white/10" /> : null}
        </div>
      ))}
    </div>
  );
}

export default function GenerateInsightPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const projectId = params.projectId;

  const [preset, setPreset] = useState<Preset | "custom">("28d");
  const [from, setFrom] = useState<string>(() => resolvePresetDates("28d").start);
  const [to, setTo] = useState<string>(() => resolvePresetDates("28d").end);
  const [comparison, setComparison] = useState<Comparison>("previous");
  const [provider, setProvider] = useState<Provider>("gemini");

  const [pendingDraft, setPendingDraft] = useState(false);
  const [pendingOneShot, setPendingOneShot] = useState<Provider | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const window = useMemo(() => {
    if (preset === "custom") {
      const { prevStart, prevEnd } = computePrev(from, to, comparison);
      return { start: from, end: to, prevStart, prevEnd };
    }
    const { start, end } = resolvePresetDates(preset);
    const { prevStart, prevEnd } = computePrev(start, end, comparison);
    return { start, end, prevStart, prevEnd };
  }, [preset, from, to, comparison]);

  const windowDays = daysInclusive(window.start, window.end);
  const compLabel = comparison === "yoy" ? "前年同期" : "前期";

  const setPresetAndSync = (p: Preset) => {
    setPreset(p);
    const { start, end } = resolvePresetDates(p);
    setFrom(start);
    setTo(end);
  };

  const buildBody = () => ({
    provider,
    window:
      preset === "custom"
        ? { from: window.start, to: window.end, comparison }
        : { preset, comparison },
  });

  async function startDraft() {
    setErr(null);
    setMsg(null);
    setPendingDraft(true);
    const res = await fetch(`/api/projects/${projectId}/insights/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody()),
    });
    setPendingDraft(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setErr(j?.error ?? "Draft 生成に失敗しました。");
      return;
    }
    const j = (await res.json()) as { draftId?: string };
    if (j.draftId) {
      router.push(`/projects/${projectId}/insights/drafts/${j.draftId}`);
    }
  }

  async function runOneShot(p: Provider) {
    setErr(null);
    setMsg(null);
    setPendingOneShot(p);
    const res = await fetch(`/api/projects/${projectId}/insights/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...buildBody(), provider: p }),
    });
    setPendingOneShot(null);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      const fallback =
        p === "claude"
          ? "Claude 経由の生成に失敗しました（BEDROCK_MODEL_ID・AWS 認証・bedrock:InvokeModel 権限を確認）。"
          : "生成に失敗しました（GEMINI_API_KEY 等を確認）。";
      setErr(j?.error ?? fallback);
      return;
    }
    const j = (await res.json()) as { insightId?: string };
    setMsg(
      p === "claude"
        ? "Claude（Bedrock）でインサイトを生成しました。"
        : "インサイトを生成しました。",
    );
    if (j.insightId) router.push(`/projects/${projectId}/insights/${j.insightId}`);
  }

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="New analysis"
        subtitle="期間と比較対象を選び、現状把握＋課題 → 示唆・仮説＋打ち手の 2 段階でレポートを生成します。"
        userEmail={session?.user?.email ?? null}
      />

      <StepIndicator active={1} />

      <Card className="mt-6 glow-border space-y-5">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-slate-400">プリセット</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["7d", "28d", "90d", "MTD", "QTD"] as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPresetAndSync(p)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  preset === p
                    ? "bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-400/40 shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                )}
              >
                {p === "7d"
                  ? "過去 7 日"
                  : p === "28d"
                    ? "過去 28 日 (既定)"
                    : p === "90d"
                      ? "過去 90 日"
                      : p === "MTD"
                        ? "今月累計"
                        : "今期累計"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                preset === "custom"
                  ? "bg-violet-400/20 text-violet-100 ring-1 ring-violet-400/40"
                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
              )}
            >
              カスタム
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-400">開始</Label>
            <Input
              type="date"
              value={preset === "custom" ? from : window.start}
              disabled={preset !== "custom"}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-400">終了</Label>
            <Input
              type="date"
              value={preset === "custom" ? to : window.end}
              disabled={preset !== "custom"}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-400">比較対象</Label>
            <select
              value={comparison}
              onChange={(e) => setComparison(e.target.value as Comparison)}
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100"
            >
              <option value="previous">直前期間</option>
              <option value="yoy">前年同期</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ai" className="normal-case">
            今期 {window.start}〜{window.end} ({windowDays}日)
          </Badge>
          <Badge tone="neutral" className="normal-case">
            vs {compLabel} {window.prevStart}〜{window.prevEnd}
          </Badge>
        </div>
      </Card>

      <Card className="mt-6 glow-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              推奨フロー — 2 段階（高品質）
            </div>
            <p className="mt-1 text-sm text-slate-300">
              ① 現状把握＋課題を生成 → 課題を確認・編集 → ② 示唆・仮説＋打ち手を生成します。
            </p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-slate-500">Step 2 用 LLM</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100"
            >
              <option value="gemini">Gemini</option>
              <option value="claude">Claude (Bedrock)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={startDraft} disabled={pendingDraft || pendingOneShot !== null} className="rounded-xl">
            {pendingDraft ? "課題ドラフトを生成中…" : "Step 1 開始：現状把握＋課題を生成"}
          </Button>
        </div>
        {pendingDraft ? (
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
            </div>
            <p className="text-xs text-slate-400">
              Stage 1 Facts → Stage 2 Issues を実行中です。完了後、課題レビュー画面に遷移します。
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="mt-6 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          1 ショットで一括生成（互換モード）
        </div>
        <p className="text-xs text-slate-500">
          Stage1〜4 を途中編集なしで一括実行します。従来の挙動と互換です。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => runOneShot("gemini")}
            disabled={pendingDraft || pendingOneShot !== null}
            className="rounded-xl"
          >
            {pendingOneShot === "gemini" ? "Gemini で生成中…" : "Gemini で一括生成"}
          </Button>
          <Button
            variant="outline"
            onClick={() => runOneShot("claude")}
            disabled={pendingDraft || pendingOneShot !== null}
            className="rounded-xl border-violet-400/40 text-violet-100 hover:bg-violet-500/15"
          >
            {pendingOneShot === "claude" ? "Claude で生成中…（Bedrock）" : "Claude で一括生成"}
          </Button>
        </div>
        {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm text-rose-300">{err}</p> : null}
        <p className="text-xs text-slate-500">
          Claude 利用時は AWS 認証情報（<code className="text-slate-400">bedrock:InvokeModel</code>{" "}
          権限あり）と <code className="text-slate-400">BEDROCK_MODEL_ID</code>{" "}
          が必要です。Bedrock コンソールで対象モデルの Model access を有効化してください。
        </p>
      </Card>
    </main>
  );
}
