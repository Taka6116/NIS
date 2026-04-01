"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";

export function InsightExportButton({ outlineText }: { outlineText: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(outlineText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = outlineText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [outlineText]);

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
        エクスポート（スライド骨子）
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0f141d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-sm font-semibold text-white">
                クライアント提案スライド骨子
              </h2>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="h-8 rounded-lg border-emerald-400/30 px-3 text-xs text-emerald-200 hover:bg-emerald-500/15"
                  onClick={handleCopy}
                >
                  {copied ? "コピーしました ✓" : "クリップボードにコピー"}
                </Button>
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
            <div className="flex-1 overflow-auto px-6 py-4">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                {outlineText}
              </pre>
            </div>
            <div className="border-t border-white/10 px-6 py-3">
              <p className="text-[10px] text-slate-500">
                この骨子をもとに Google Slides / PowerPoint / Keynote
                でスライドを作成してください。各スライドの区切り線がページ切替に対応します。
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
