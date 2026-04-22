"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InsightPipeline } from "@/types/nis";

const tabs: { id: "1" | "2" | "3" | "4"; labelJa: string; labelEn: string }[] = [
  { id: "1", labelJa: "① 現状整理", labelEn: "Fact" },
  { id: "2", labelJa: "② 課題", labelEn: "Issue" },
  { id: "3", labelJa: "③ 示唆・仮説", labelEn: "Hypothesis" },
  { id: "4", labelJa: "④ 打ち手", labelEn: "Action" },
];

const FACTOR_LABEL: Record<string, string> = {
  "crawl-index": "クロール/インデックス",
  technical: "テクニカル",
  "on-page": "オンページ",
  "content-quality": "コンテンツ品質",
  authority: "権威性・被リンク",
  "ux-clarity": "UX(Clarity)",
  tracking: "計測",
  "seasonality-external": "外部要因",
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  "quick-win": "クイックウィン",
  strategic: "戦略施策",
  structural: "構造改革",
};

export function InsightStageTabs({ pipeline }: { pipeline: InsightPipeline }) {
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("1");

  const sortedActions = [...pipeline.actions].sort((a, b) => {
    const sa = a.ice?.score ?? -1;
    const sb = b.ice?.score ?? -1;
    return sb - sa;
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={
              active === t.id
                ? "rounded-full bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/30"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
            }
          >
            <span className="hidden sm:inline">{t.labelJa}</span>
            <span className="sm:ml-1.5 sm:text-slate-500">({t.labelEn})</span>
          </button>
        ))}
      </div>

      {active === "1" ? (
        <div className="space-y-3">
          {pipeline.facts.length === 0 ? (
            <p className="text-sm text-slate-500">事実が生成されませんでした。</p>
          ) : null}
          {pipeline.facts.map((f) => (
            <Card key={f.id} className="border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{f.id}</span>
                {f.source ? (
                  <Badge tone="neutral" className="normal-case text-[10px]">
                    {f.source}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-200">{f.statement}</p>
              {f.metricRef || f.valueText ? (
                <p className="mt-1 text-xs text-slate-500">
                  {[f.metricRef, f.valueText].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {active === "2" ? (
        <div className="space-y-3">
          {pipeline.issues.length === 0 ? (
            <p className="text-sm text-slate-500">課題が生成されませんでした。</p>
          ) : null}
          {pipeline.issues.map((i) => (
            <Card key={i.id} className="border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{i.id}</span>
                <Badge tone="ai" className="normal-case">
                  {i.category}
                </Badge>
                <Badge tone={i.severity === "high" ? "danger" : "neutral"} className="normal-case">
                  {i.severity}
                </Badge>
              </div>
              <h3 className="mt-2 text-base font-semibold text-white">{i.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{i.description}</p>
              {i.relatedFactIds.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">関連 fact: {i.relatedFactIds.join(", ")}</p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {active === "3" ? (
        <div className="space-y-3">
          {pipeline.hypotheses.length === 0 ? (
            <p className="text-sm text-slate-500">仮説が生成されませんでした。</p>
          ) : null}
          {pipeline.hypotheses.map((h) => (
            <Card key={h.id} className="border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{h.id}</span>
                <span className="text-xs text-slate-500">issue {h.issueId}</span>
                {h.factorCategory ? (
                  <Badge tone="ai" className="normal-case">
                    {FACTOR_LABEL[h.factorCategory] ?? h.factorCategory}
                  </Badge>
                ) : null}
                <Badge tone="neutral" className="normal-case text-[10px]">
                  confidence: {h.confidence}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-200">{h.statement}</p>
              {h.mechanism ? (
                <p className="mt-2 text-sm text-cyan-100/90">
                  <span className="font-medium text-slate-400">因果: </span>
                  {h.mechanism}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-400">
                <span className="font-medium text-slate-500">データとの関係: </span>
                {h.dataSupport}
              </p>
              {h.internalFactors && h.internalFactors.length > 0 ? (
                <div className="mt-2 text-xs text-emerald-200/80">
                  <span className="font-medium text-emerald-300/80">内部要因（自社改善可）: </span>
                  {h.internalFactors.join(" / ")}
                </div>
              ) : null}
              {h.externalFactors && h.externalFactors.length > 0 ? (
                <div className="mt-1 text-xs text-amber-200/80">
                  <span className="font-medium text-amber-300/80">外部要因: </span>
                  {h.externalFactors.join(" / ")}
                </div>
              ) : null}
              {h.nextValidationStep ? (
                <p className="mt-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-500">次の検証手段: </span>
                  {h.nextValidationStep}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {active === "4" ? (
        <div className="space-y-3">
          {sortedActions.length === 0 ? (
            <p className="text-sm text-slate-500">打ち手が生成されませんでした。</p>
          ) : null}
          {sortedActions.map((a) => (
            <Card key={a.id} className="border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{a.id}</span>
                <Badge
                  tone={a.priority === "high" ? "danger" : a.priority === "medium" ? "neutral" : "success"}
                  className="normal-case"
                >
                  {a.priority}
                </Badge>
                {a.type ? (
                  <Badge tone="ai" className="normal-case">
                    {ACTION_TYPE_LABEL[a.type] ?? a.type}
                  </Badge>
                ) : null}
                {a.ice ? (
                  <Badge tone="success" className="normal-case">
                    ICE {a.ice.score.toFixed(1)}（I{a.ice.impact} / C{a.ice.confidence} / E{a.ice.ease}）
                  </Badge>
                ) : null}
                <span className="text-xs text-slate-500">
                  {a.issueId} · {a.hypothesisId}
                </span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-white">{a.title}</h3>
              {a.targetKpi ? (
                <p className="mt-2 text-xs text-cyan-100/90">
                  <span className="font-medium text-slate-400">目標 KPI: </span>
                  {a.targetKpi.metric} を {a.targetKpi.direction === "up" ? "↑" : "↓"}（
                  {a.targetKpi.targetDelta}・{a.targetKpi.timelineWeeks} 週）
                </p>
              ) : null}
              {a.leadIndicator ? (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="font-medium text-slate-500">先行指標: </span>
                  {a.leadIndicator}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">工数: {a.effort}</p>
              <p className="mt-2 text-sm text-slate-400">期待効果: {a.expectedImpact}</p>
              {a.steps.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-cyan-100/90">
                  {a.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {a.risks && a.risks.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-500/5 p-2 text-xs text-amber-200/90">
                  <span className="font-semibold">リスク: </span>
                  {a.risks.join(" / ")}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
