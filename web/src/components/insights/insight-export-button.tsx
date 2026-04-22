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
  const [tab, setTab] = useState<TabKey>("marp");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const tabHint: Record<TabKey, string> = {
    outline:
      "シンプルなテキスト版。そのままコピペして議事メモやメールに貼る用途に。",
    marp:
      ".md をダウンロードし、ローカルで `npx @marp-team/marp-cli slides.md -o slides.pptx` を実行すると PPTX/PDF が生成できます。そのまま PowerPoint / Google Slides へアップロード可能。",
    claude:
      "そのままご自身の Claude に投げると、ビジュアル付きのスライド案を作ってくれます。",
  };

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
            { k: "marp", label: "Marp Markdown（推奨）" },
            { k: "outline", label: "スライド骨子（テキスト）" },
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
        <div className="space-y-1 border-t border-white/10 px-6 py-3">
          <p className="text-[10px] text-slate-400">{tabHint[tab]}</p>
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
