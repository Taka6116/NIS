"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

type SourceStatus = "ok" | "skipped_missing_config" | "failed";

function statusLabel(status: SourceStatus, count: number, error?: string): string {
  if (status === "ok") return `${count} 行`;
  if (status === "skipped_missing_config") return `スキップ（未設定）`;
  return `エラー${error ? `: ${error.slice(0, 60)}` : ""}`;
}

function sourceColor(status: SourceStatus) {
  if (status === "ok") return "text-emerald-400";
  if (status === "skipped_missing_config") return "text-amber-400";
  return "text-rose-400";
}

export function SyncButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [lines, setLines] = useState<{ label: string; text: string; status: SourceStatus }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleSync() {
    setState("running");
    setLines([]);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setState("error");
        setErrorMsg(body.error ?? "同期に失敗しました");
        return;
      }
      const r = body.result;
      setState("done");

      const clarityStatus: SourceStatus = r.claritySkipped
        ? "skipped_missing_config"
        : (r.clarityStatus ?? (r.clarityError ? "failed" : "ok"));

      setLines([
        {
          label: "GSC",
          text: statusLabel(r.gscStatus ?? "ok", r.gscCount, r.gscError),
          status: r.gscStatus ?? "ok",
        },
        {
          label: "GA4",
          text: statusLabel(r.ga4Status ?? "ok", r.ga4Count, r.ga4Error),
          status: r.ga4Status ?? "ok",
        },
        {
          label: "Clarity",
          text: clarityStatus === "skipped_missing_config"
            ? `スキップ（${r.claritySkipReason ?? "未設定"}）`
            : statusLabel(clarityStatus, r.clarityCount, r.clarityError),
          status: clarityStatus,
        },
      ]);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error");
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
      {state === "error" && errorMsg && (
        <p className="text-sm text-rose-400">{errorMsg}</p>
      )}
      {lines.length > 0 && (
        <ul className="space-y-1 text-xs">
          {lines.map((l) => (
            <li key={l.label} className={`flex gap-2 ${sourceColor(l.status)}`}>
              <span className="w-12 font-semibold">{l.label}:</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
