"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function SyncButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<string>("");

  async function handleSync() {
    setState("running");
    setResult("");
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setState("error");
        setResult(body.error ?? "同期に失敗しました");
        return;
      }
      const r = body.result;
      setState("done");

      let clarityMsg = `Clarity: ${r.clarityCount} 行`;
      if (r.claritySkipped) {
        clarityMsg = `Clarity: スキップ（${r.claritySkipReason ?? "未設定"}）`;
      } else if (r.clarityError) {
        clarityMsg = `Clarity: エラー — ${r.clarityError}`;
      }
      setResult(`GSC: ${r.gscCount} 行 / GA4: ${r.ga4Count} 行 / ${clarityMsg}`);
    } catch (e) {
      setState("error");
      setResult(e instanceof Error ? e.message : "Network error");
    }
  }

  const running = state === "running";

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleSync}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
      >
        {running ? (
          <LoadingSpinner variant="ring" size="sm" className="text-white" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {running ? "同期中…" : "データ同期を実行"}
      </button>
      {result && (
        <p className={`flex items-center gap-1.5 text-sm ${state === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {result}
        </p>
      )}
    </div>
  );
}
