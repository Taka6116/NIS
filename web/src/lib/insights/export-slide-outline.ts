import type { InsightRecord } from "@/types/nis";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

function sortBySeverity<T extends { severity: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function sortByConfidence<T extends { confidence: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence]);
}

function sortByPriority<T extends { priority: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority]);
}

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
      push(`  データ裏付け: ${h.dataSupport}`);
      push(`  確信度: ${h.confidence}`);
    }
    push("");

    // Slide 6–N: Actions
    const sortedActions = sortByPriority(actions);
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
        push(`★ [${a.priority.toUpperCase()}] ${a.title}`);
        push(`  工数: ${a.effort}`);
        push(`  期待効果: ${a.expectedImpact}`);
        if (a.steps.length > 0) {
          push("  実施ステップ:");
          a.steps.forEach((s, idx) => push(`    ${idx + 1}. ${s}`));
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
