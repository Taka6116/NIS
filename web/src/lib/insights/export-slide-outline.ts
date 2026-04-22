import type { InsightRecord } from "@/types/nis";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

function sortBySeverity<T extends { severity: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function sortByConfidence<T extends { confidence: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence]);
}

function sortByIceThenPriority<T extends { priority: "high" | "medium" | "low"; ice?: { score: number } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const sa = a.ice?.score ?? -1;
    const sb = b.ice?.score ?? -1;
    if (sa !== sb) return sb - sa;
    return SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority];
  });
}

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

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function generateSlideOutline(opts: {
  insight: InsightRecord;
  projectName: string;
  domain: string;
}): string {
  const { insight, projectName, domain } = opts;
  const lines: string[] = [];

  const push = (...strs: string[]) => {
    for (const s of strs) lines.push(s);
  };

  const divider = "===================================";

  // Slide 1: Cover
  push(divider);
  push("スライド 1: 表紙");
  push(divider);
  push(`タイトル: 「${projectName} サイト分析レポート」`);
  push(`サブタイトル: 「${insight.period.start} 〜 ${insight.period.end}」`);
  push("提供元: NIS (Nihon Insight System)");
  push("");

  // Slide 2: Executive Summary
  push(divider);
  push("スライド 2: エグゼクティブサマリー");
  push(divider);
  push(`- ${insight.summary}`);
  push(`- 最優先アクション: ${insight.topPriority.action}`);
  push(`  → 理由: ${insight.topPriority.reason}`);
  push("");

  if (insight.pipeline) {
    const { facts, issues, hypotheses, actions } = insight.pipeline;

    // Slide 3: Facts
    push(divider);
    push("スライド 3: 現状データ（ファクト）");
    push(divider);
    const topFacts = facts.slice(0, 5);
    if (topFacts.length === 0) {
      push("（ファクトデータなし）");
    }
    for (const f of topFacts) {
      const source = f.source ? `（${f.source}）` : "";
      push(`- ${f.statement}${source}`);
      if (f.valueText) push(`  数値: ${f.valueText}`);
    }
    if (facts.length > 5) push(`  ...他 ${facts.length - 5} 件`);
    push("");

    // Slide 4: Issues
    push(divider);
    push("スライド 4: 特定された課題");
    push(divider);
    const sortedIssues = sortBySeverity(issues);
    if (sortedIssues.length === 0) {
      push("（課題データなし）");
    }
    for (const i of sortedIssues) {
      push(`■ [${i.severity.toUpperCase()}] ${i.title}`);
      push(`  ${i.description}`);
    }
    push("");

    // Slide 5: Hypotheses
    push(divider);
    push("スライド 5: 分析から導かれた仮説");
    push(divider);
    const sortedHyp = sortByConfidence(hypotheses);
    if (sortedHyp.length === 0) {
      push("（仮説データなし）");
    }
    for (const h of sortedHyp) {
      push(`▶ ${h.statement}`);
      if (h.factorCategory) push(`  要因カテゴリ: ${FACTOR_LABEL[h.factorCategory] ?? h.factorCategory}`);
      if (h.mechanism) push(`  因果: ${h.mechanism}`);
      push(`  データ裏付け: ${h.dataSupport}`);
      if (h.internalFactors && h.internalFactors.length > 0) {
        push(`  内部要因（自社改善可）: ${h.internalFactors.join(" / ")}`);
      }
      if (h.externalFactors && h.externalFactors.length > 0) {
        push(`  外部要因: ${h.externalFactors.join(" / ")}`);
      }
      if (h.nextValidationStep) push(`  次の検証: ${h.nextValidationStep}`);
      push(`  確信度: ${h.confidence}`);
    }
    push("");

    // Slide 6–N: Actions (ICE スコア降順)
    const sortedActions = sortByIceThenPriority(actions);
    let slideNum = 6;
    if (sortedActions.length === 0) {
      push(divider);
      push(`スライド ${slideNum}: 推奨アクション`);
      push(divider);
      push("（アクションデータなし）");
      push("");
      slideNum++;
    } else {
      for (const a of sortedActions) {
        push(divider);
        push(`スライド ${slideNum}: 推奨アクション — ${a.title}`);
        push(divider);
        const typeTag = a.type ? `[${ACTION_TYPE_LABEL[a.type] ?? a.type}] ` : "";
        push(`★ ${typeTag}[${a.priority.toUpperCase()}] ${a.title}`);
        if (a.ice) {
          push(`  ICE: ${a.ice.score.toFixed(1)}（I ${a.ice.impact} / C ${a.ice.confidence} / E ${a.ice.ease}）`);
        }
        if (a.targetKpi) {
          push(
            `  目標 KPI: ${a.targetKpi.metric} を ${a.targetKpi.direction === "up" ? "↑" : "↓"} ${a.targetKpi.targetDelta}（${a.targetKpi.timelineWeeks} 週）`,
          );
        }
        if (a.leadIndicator) push(`  先行指標: ${a.leadIndicator}`);
        push(`  工数: ${a.effort}`);
        push(`  期待効果: ${a.expectedImpact}`);
        if (a.steps.length > 0) {
          push("  実施ステップ:");
          a.steps.forEach((s, idx) => push(`    ${idx + 1}. ${s}`));
        }
        if (a.risks && a.risks.length > 0) {
          push(`  リスク: ${a.risks.join(" / ")}`);
        }
        push("");
        slideNum++;
      }
    }

    // Next steps
    push(divider);
    push(`スライド ${slideNum}: ネクストステップ`);
    push(divider);
    const highActions = sortedActions.filter((a) => a.priority === "high");
    if (highActions.length > 0) {
      push("最優先で着手すべき項目:");
      for (const a of highActions) push(`  - ${a.title}`);
    } else {
      push("- 上記アクションを優先度順に実施");
    }
    push("- 次回レビュー目安: 実施後 1〜2 週間");
    push("");
    slideNum++;

    // Appendix
    push(divider);
    push(`スライド ${slideNum}: 補足・参考データ`);
    push(divider);
  } else {
    // Fallback for legacy records without pipeline
    push(divider);
    push("スライド 3: 発見事項");
    push(divider);
    if (insight.findings.length === 0) {
      push("（発見事項なし）");
    }
    for (const f of insight.findings) {
      push(`■ [${f.severity.toUpperCase()} / ${f.category}] ${f.title}`);
      if (f.observation) push(`  観測: ${f.observation}`);
      if (f.hypothesis) push(`  仮説: ${f.hypothesis}`);
      if (f.actions.length > 0) {
        push("  推奨アクション:");
        f.actions.forEach((a, idx) => push(`    ${idx + 1}. ${a}`));
      }
      if (f.expectedImpact) push(`  期待効果: ${f.expectedImpact}`);
    }
    push("");

    push(divider);
    push("スライド 4: ネクストステップ");
    push(divider);
    push(`- 最優先: ${insight.topPriority.action}`);
    push("- 次回レビュー目安: 実施後 1〜2 週間");
    push("");

    push(divider);
    push("スライド 5: 補足・参考データ");
    push(divider);
  }

  push(`- 対象ドメイン: ${domain}`);
  if (insight.modelProvider) {
    const model = insight.modelProvider === "claude" ? "Claude" : "Gemini";
    const ver = insight.modelVersion ? ` (${insight.modelVersion})` : "";
    push(`- 分析モデル: ${model}${ver}`);
  }
  if (insight.tokenUsage) push(`- トークン使用量: ${insight.tokenUsage.toLocaleString()}`);
  push(`- 生成日時: ${formatDate(insight.generatedAtIso)}`);

  return lines.join("\n");
}
