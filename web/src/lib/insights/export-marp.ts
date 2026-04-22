import type { InsightRecord } from "@/types/nis";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

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
  "quick-win": "Quick Win",
  strategic: "戦略",
  structural: "構造改革",
};

function esc(s: string): string {
  return s.replace(/\r?\n/g, " ");
}

function sortIssues<T extends { severity: "high" | "medium" | "low" }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function sortActions<T extends { priority: "high" | "medium" | "low"; ice?: { score: number } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const sa = a.ice?.score ?? -1;
    const sb = b.ice?.score ?? -1;
    if (sa !== sb) return sb - sa;
    return SEVERITY_ORDER[a.priority] - SEVERITY_ORDER[b.priority];
  });
}

/**
 * Marp Markdown を生成します。
 *
 * Marp CLI （`marp slides.md -o slides.pptx`）で PPTX/PDF に変換できます。
 * https://marp.app/
 */
export function generateMarpMarkdown(opts: {
  insight: InsightRecord;
  projectName: string;
  domain: string;
}): string {
  const { insight, projectName, domain } = opts;
  const out: string[] = [];
  const push = (...s: string[]) => out.push(...s);
  const slideBreak = () => push("", "---", "");

  // Front matter
  push(
    "---",
    "marp: true",
    "theme: default",
    "paginate: true",
    "size: 16:9",
    `title: ${projectName} サイト分析レポート`,
    "style: |",
    "  section { font-family: 'Noto Sans JP', sans-serif; font-size: 24px; }",
    "  section.cover h1 { font-size: 48px; }",
    "  section.cover h2 { font-size: 28px; color: #475569; }",
    "  table { font-size: 20px; }",
    "  .small { font-size: 18px; color: #64748b; }",
    "  .high { color: #dc2626; font-weight: bold; }",
    "  .medium { color: #d97706; font-weight: bold; }",
    "  .low { color: #2563eb; }",
    "---",
    "",
  );

  // Cover
  push(
    "<!-- _class: cover -->",
    "",
    `# ${projectName} サイト分析レポート`,
    "",
    `## ${insight.period.start} 〜 ${insight.period.end}`,
    "",
    "<span class=\"small\">NIS (Nihon Insight System)</span>",
  );
  slideBreak();

  // Executive summary
  push(
    "# エグゼクティブサマリー",
    "",
    `- ${esc(insight.summary)}`,
    "",
    `**最優先アクション**: ${esc(insight.topPriority.action)}`,
    "",
    `<span class=\"small\">理由: ${esc(insight.topPriority.reason)}</span>`,
  );
  slideBreak();

  if (insight.pipeline) {
    const { facts, issues, hypotheses, actions } = insight.pipeline;

    // Facts
    push("# 現状データ（ファクト）", "");
    if (facts.length === 0) {
      push("（ファクトデータなし）");
    } else {
      push("| # | 事実 | 数値 | source |", "| --- | --- | --- | --- |");
      facts.slice(0, 8).forEach((f, i) => {
        push(`| ${i + 1} | ${esc(f.statement)} | ${esc(f.valueText ?? "")} | ${f.source ?? ""} |`);
      });
      if (facts.length > 8) push("", `<span class=\"small\">他 ${facts.length - 8} 件</span>`);
    }
    slideBreak();

    // Issues
    push("# 特定された課題", "");
    const sortedIssues = sortIssues(issues);
    if (sortedIssues.length === 0) {
      push("（課題データなし）");
    } else {
      for (const i of sortedIssues) {
        push(`- <span class=\"${i.severity}\">[${i.severity.toUpperCase()}]</span> **${esc(i.title)}**`);
        push(`  <span class=\"small\">${esc(i.description)}</span>`);
      }
    }
    slideBreak();

    // Hypotheses（分割: 1 枚 3 件まで）
    if (hypotheses.length === 0) {
      push("# 仮説", "", "（仮説データなし）");
      slideBreak();
    } else {
      const chunk = 3;
      for (let i = 0; i < hypotheses.length; i += chunk) {
        push("# 分析から導かれた仮説", "");
        for (const h of hypotheses.slice(i, i + chunk)) {
          push(`### ▶ ${esc(h.statement)}`);
          if (h.factorCategory) push(`- 要因: ${FACTOR_LABEL[h.factorCategory] ?? h.factorCategory}`);
          if (h.mechanism) push(`- 因果: ${esc(h.mechanism)}`);
          push(`- データ裏付け: ${esc(h.dataSupport)}`);
          if (h.internalFactors?.length) push(`- 内部要因: ${h.internalFactors.join(" / ")}`);
          if (h.externalFactors?.length) push(`- 外部要因: ${h.externalFactors.join(" / ")}`);
          if (h.nextValidationStep) push(`- 次の検証: ${esc(h.nextValidationStep)}`);
          push(`- 確信度: ${h.confidence}`);
          push("");
        }
        slideBreak();
      }
    }

    // Actions (1 枚 1 件)
    const sortedActions = sortActions(actions);
    if (sortedActions.length === 0) {
      push("# 推奨アクション", "", "（アクションデータなし）");
      slideBreak();
    } else {
      for (const a of sortedActions) {
        const typeTag = a.type ? `${ACTION_TYPE_LABEL[a.type] ?? a.type} / ` : "";
        push(`# 推奨アクション: ${esc(a.title)}`, "");
        push(`<span class=\"small\">${typeTag}優先度 ${a.priority.toUpperCase()}</span>`, "");
        if (a.ice) {
          push(
            `**ICE**: ${a.ice.score.toFixed(1)}　(I: ${a.ice.impact} / C: ${a.ice.confidence} / E: ${a.ice.ease})`,
            "",
          );
        }
        if (a.targetKpi) {
          push(
            `**目標 KPI**: ${a.targetKpi.metric} を ${a.targetKpi.direction === "up" ? "↑" : "↓"} ${a.targetKpi.targetDelta}（${a.targetKpi.timelineWeeks} 週）`,
            "",
          );
        }
        if (a.leadIndicator) push(`**先行指標**: ${esc(a.leadIndicator)}`, "");
        push(`**工数**: ${esc(a.effort)}`, "");
        push(`**期待効果**: ${esc(a.expectedImpact)}`, "");
        if (a.steps.length > 0) {
          push("**実施ステップ**:");
          a.steps.forEach((s, idx) => push(`${idx + 1}. ${esc(s)}`));
          push("");
        }
        if (a.risks?.length) push(`<span class=\"small\">リスク: ${a.risks.join(" / ")}</span>`, "");
        slideBreak();
      }
    }

    // Next steps
    push("# ネクストステップ", "");
    const highActions = sortedActions.filter((a) => a.priority === "high");
    if (highActions.length > 0) {
      push("最優先で着手すべき項目:");
      for (const a of highActions) push(`- ${esc(a.title)}`);
    } else {
      push("- 上記アクションを優先度順に実施");
    }
    push("", "- 次回レビュー目安: 実施後 1〜2 週間");
    slideBreak();
  } else {
    push("# 発見事項", "");
    for (const f of insight.findings) {
      push(`- <span class=\"${f.severity}\">[${f.severity.toUpperCase()} / ${f.category}]</span> **${esc(f.title)}**`);
      if (f.observation) push(`  - 観測: ${esc(f.observation)}`);
      if (f.hypothesis) push(`  - 仮説: ${esc(f.hypothesis)}`);
    }
    slideBreak();
  }

  // Appendix
  push("# 補足・参考データ", "");
  push(`- 対象ドメイン: ${domain}`);
  if (insight.modelProvider) {
    const model = insight.modelProvider === "claude" ? "Claude" : "Gemini";
    const ver = insight.modelVersion ? ` (${insight.modelVersion})` : "";
    push(`- 分析モデル: ${model}${ver}`);
  }
  if (insight.tokenUsage) push(`- トークン使用量: ${insight.tokenUsage.toLocaleString()}`);
  push(`- 生成日時: ${insight.generatedAtIso}`);

  return out.join("\n");
}
