"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function GenerateInsightPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const projectId = params.projectId;

  async function run() {
    setPending(true);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/projects/${projectId}/insights/generate`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setErr(j?.error ?? "生成に失敗しました（GEMINI_API_KEY 等を確認）。");
      return;
    }
    const j = (await res.json()) as { insightId?: string };
    setMsg("インサイトを生成しました。");
    if (j.insightId) router.push(`/projects/${projectId}/insights/${j.insightId}`);
  }

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="New analysis"
        subtitle="Gemini が週次バンドルからインサイトを生成し、DynamoDB に保存します。"
        userEmail={session?.user?.email ?? null}
      />
      <Card className="mt-8 space-y-4">
        <p className="text-sm text-slate-300">
          ルールベース検知でアラートを作ったうえで、設計書どおりの JSON スキーマに沿って LLM が文章化します。
        </p>
        <Button onClick={run} disabled={pending} className="rounded-xl">
          {pending ? "生成中…" : "Generate now"}
        </Button>
        {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
        {err ? <p className="text-sm text-rose-300">{err}</p> : null}
      </Card>
    </main>
  );
}
