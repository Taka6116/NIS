"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ExportPayload = {
  outlineText: string;
  marpMarkdown: string;
  claudeVisualPrompt: string;
};

type TabKey = "outline" | "marp" | "claude";

export function InsightExportButton({ outlineText, marpMarkdown, claudeVisualPrompt }: ExportPayload) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<TabKey | null>(null);
  const [tab, setTab] = useState<TabKey>("outline");
  const [mounted, setMounted] = useState(false);
  const [slidesBusy, setSlidesBusy] = useState(false);
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeText = useMemo(() => {
    if (tab === "outline") return outlineText;
    if (tab === "marp") return marpMarkdown;
    return claudeVisualPrompt;
  }, [tab, outlineText, marpMarkdown, claudeVisualPrompt]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = activeText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(tab);
    setTimeout(() => setCopied(null), 2000);
  }, [activeText, tab]);

  const handleDownloadMarp = useCallback(() => {
    const blob = new Blob([marpMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "insight-slides.marp.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [marpMarkdown]);

  const handleCreateGoogleSlides = useCallback(async () => {
    setSlidesBusy(true);
    setSlidesError(null);
    setSlidesUrl(null);
    try {
      const m = window.location.pathname.match(/\/projects\/([^/]+)\/insights\/([^/]+)/);
      if (!m) throw new Error("Insight URL を認識できませんでした");
      const [, projectId, insightId] = m;
      const res = await fetch(`/api/projects/${projectId}/insights/${insightId}/slides`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setSlidesUrl(j.url as string);
    } catch (e) {
      setSlidesError(e instanceof Error ? e.message : String(e));
    } finally {
      setSlidesBusy(false);
    }
  }, []);

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0f141d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-semibold text-white">エクスポート</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-8 rounded-lg border-emerald-400/30 px-3 text-xs text-emerald-200 hover:bg-emerald-500/15"
              onClick={handleCopy}
            >
              {copied === tab ? "コピーしました ✓" : "クリップボードにコピー"}
            </Button>
            {tab === "marp" ? (
              <Button
                variant="outline"
                className="h-8 rounded-lg border-sky-400/30 px-3 text-xs text-sky-200 hover:bg-sky-500/15"
                onClick={handleDownloadMarp}
              >
                .md ダウンロード
              </Button>
            ) : null}
            {tab === "outline" ? (
              <Button
                variant="outline"
                className="h-8 rounded-lg border-yellow-300/40 px-3 text-xs text-yellow-100 hover:bg-yellow-500/15 disabled:opacity-60"
                onClick={handleCreateGoogleSlides}
                disabled={slidesBusy}
              >
                {slidesBusy ? "Slides 生成中…" : "Google Slides を作成"}
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-white/5 px-6 py-2">
          {([
            { k: "outline", label: "スライド骨子（テキスト）" },
            { k: "marp", label: "Marp Markdown" },
            { k: "claude", label: "Claude 用ビジュアル生成プロンプト" },
          ] as { k: TabKey; label: string }[]).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={
                "rounded-md px-3 py-1.5 text-xs " +
                (tab === k
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-slate-200")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
            {activeText}
          </pre>
        </div>
        <div className="space-y-2 border-t border-white/10 px-6 py-3">
          {slidesError ? (
            <p className="text-[11px] text-rose-300">Google Slides 作成エラー: {slidesError}</p>
          ) : null}
          {slidesUrl ? (
            <p className="text-[11px] text-emerald-300">
              作成しました:{" "}
              <a className="underline" href={slidesUrl} target="_blank" rel="noreferrer">
                {slidesUrl}
              </a>
            </p>
          ) : null}
          <p className="text-[10px] text-slate-500">
            「スライド骨子」はテキスト版、「Marp Markdown」は Marp CLI で PPTX/PDF
            に変換可能、「Claude 用ビジュアル生成プロンプト」は別途 Claude に投げてビジュアル付きスライドを生成させる用途です。
          </p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 rounded-xl border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/15"
        onClick={() => setOpen(true)}
      >
        <span className="text-base leading-none" aria-hidden>
          📋
        </span>
        エクスポート
      </Button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
