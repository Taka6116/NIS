"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  projectId: string;
  insightSk: string;
  initialToken?: string;
};

export function InsightShareButton({ projectId, insightSk, initialToken }: Props) {
  const [token, setToken] = useState<string | undefined>(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sk = encodeURIComponent(insightSk);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/share/${token}` : null;

  const issueToken = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights/${sk}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setToken(j.token as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [projectId, sk]);

  const revoke = useCallback(async () => {
    if (!confirm("共有リンクを無効化しますか？")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights/${sk}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setToken(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [projectId, sk]);

  const copy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [url]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {token && url ? (
        <>
          <input
            type="text"
            readOnly
            value={url}
            className="w-64 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[11px] text-slate-100"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            className="h-8 rounded-lg border-emerald-400/30 px-3 text-xs text-emerald-200 hover:bg-emerald-500/15"
            onClick={copy}
          >
            {copied ? "コピーしました ✓" : "コピー"}
          </Button>
          <Button
            variant="outline"
            className="h-8 rounded-lg border-rose-400/30 px-3 text-xs text-rose-200 hover:bg-rose-500/15"
            onClick={revoke}
            disabled={busy}
          >
            {busy ? "…" : "リンクを無効化"}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          className="gap-1.5 rounded-xl border-sky-400/40 text-sky-100 hover:bg-sky-500/15"
          onClick={issueToken}
          disabled={busy}
        >
          <span aria-hidden>🔗</span>
          {busy ? "発行中…" : "共有リンクを発行"}
        </Button>
      )}
      {error ? <span className="text-[10px] text-rose-300">{error}</span> : null}
    </div>
  );
}
