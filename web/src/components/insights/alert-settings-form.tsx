"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { ProjectAlertConfig } from "@/types/nis";

type Rule = ProjectAlertConfig["rules"][number];

type Props = {
  projectId: string;
  initial: ProjectAlertConfig;
};

export function AlertSettingsForm({ projectId, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [autoTrigger, setAutoTrigger] = useState(!!initial.autoTriggerDraft);
  const [slackUrl, setSlackUrl] = useState(initial.slackWebhookUrl ?? "");
  const [rules, setRules] = useState<Rule[]>(initial.rules);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateRule = (idx: number, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };
  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        metric: "sessions",
        operator: "drop_pct",
        threshold: 20,
        window: "d7",
        severity: "medium",
      },
    ]);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          autoTriggerDraft: autoTrigger,
          slackWebhookUrl: slackUrl || undefined,
          rules,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setMsg("保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            アラートを有効化
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={autoTrigger}
              onChange={(e) => setAutoTrigger(e.target.checked)}
            />
            発火時に Draft 分析を自動起動
          </label>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Slack Webhook URL（任意）
          </label>
          <input
            type="text"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            未入力の場合は、環境変数 SLACK_WEBHOOK_URL を使用します。
          </p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">監視ルール</h3>
          <Button variant="outline" className="h-7 rounded px-3 text-xs" onClick={addRule}>
            + ルール追加
          </Button>
        </div>
        <div className="mt-3 space-y-3">
          {rules.length === 0 ? (
            <p className="text-xs text-slate-500">ルールがありません。</p>
          ) : (
            rules.map((r, idx) => (
              <div
                key={r.id}
                className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[1.3fr_1fr_0.9fr_0.9fr_1fr_auto]"
              >
                <div>
                  <label className="text-[10px] text-slate-500">メトリクス</label>
                  <select
                    value={r.metric}
                    onChange={(e) => updateRule(idx, { metric: e.target.value })}
                    className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="sessions">sessions</option>
                    <option value="users">users</option>
                    <option value="conversions">conversions</option>
                    <option value="clicks">clicks</option>
                    <option value="impressions">impressions</option>
                    <option value="bounceRate">bounceRate</option>
                    <option value="avgPosition">avgPosition</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">演算子</label>
                  <select
                    value={r.operator}
                    onChange={(e) =>
                      updateRule(idx, { operator: e.target.value as Rule["operator"] })
                    }
                    className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="drop_pct">下落 %</option>
                    <option value="rise_pct">上昇 %</option>
                    <option value="delta_pt">pt 変化</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">閾値</label>
                  <input
                    type="number"
                    value={r.threshold}
                    onChange={(e) => updateRule(idx, { threshold: Number(e.target.value) })}
                    className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">期間</label>
                  <select
                    value={r.window}
                    onChange={(e) => updateRule(idx, { window: e.target.value as Rule["window"] })}
                    className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="d7">7日</option>
                    <option value="d28">28日</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Severity</label>
                  <select
                    value={r.severity}
                    onChange={(e) =>
                      updateRule(idx, { severity: e.target.value as Rule["severity"] })
                    }
                    className="mt-0.5 w-full rounded bg-black/30 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="h-7 rounded px-2 text-[10px] text-rose-200"
                    onClick={() => removeRule(idx)}
                  >
                    削除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button className="min-w-[6rem] rounded-xl" onClick={save} disabled={busy}>
          {busy ? (
            <>
              <LoadingSpinner variant="ring" size="sm" />
              保存中…
            </>
          ) : (
            "保存"
          )}
        </Button>
        {msg ? <span className="text-xs text-emerald-300">{msg}</span> : null}
        {error ? <span className="text-xs text-rose-300">エラー: {error}</span> : null}
      </div>
    </div>
  );
}
