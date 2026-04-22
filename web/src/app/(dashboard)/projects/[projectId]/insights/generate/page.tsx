"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

type Provider = "gemini" | "claude";

export default function GenerateInsightPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const projectId = params.projectId;

  async function run(provider: Provider) {
    setPending(provider);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/projects/${projectId}/insights/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    setPending(null);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      const fallback =
        provider === "claude"
          ? "Claude 経由の生成に失敗しました（BEDROCK_MODEL_ID・AWS 認証・bedrock:InvokeModel 権限を確認）。"
          : "生成に失敗しました（GEMINI_API_KEY 等を確認）。";
      setErr(j?.error ?? fallback);
      return;
    }
    const j = (await res.json()) as { insightId?: string };
    setMsg(provider === "claude" ? "Claude（Bedrock）でインサイトを生成しました。" : "インサイトを生成しました。");
    if (j.insightId) router.push(`/projects/${projectId}/insights/${j.insightId}`);
  }

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="New analysis"
        subtitle="Gemini / Claude (Amazon Bedrock) を Vercel 上の API から直接実行し、同じ 4 段階 JSON を DynamoDB に保存します。"
        userEmail={session?.user?.email ?? null}
      />
      <Card className="mt-8 space-y-4">
        <p className="text-sm text-slate-300">
          ルールベース検知のあと、①ファクト → ②課題 → ③仮説 → ④打ち手の順で LLM が処理します。Claude 経路は最大数分かかる場合があります。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => run("gemini")} disabled={pending !== null} className="rounded-xl">
            {pending === "gemini" ? "Gemini で生成中…" : "Generate now"}
          </Button>
          <Button
            variant="outline"
            onClick={() => run("claude")}
            disabled={pending !== null}
            className="rounded-xl border-violet-400/40 text-violet-100 hover:bg-violet-500/15"
          >
            {pending === "claude" ? "Claude で生成中…（Bedrock）" : "Analyze with Claude"}
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
