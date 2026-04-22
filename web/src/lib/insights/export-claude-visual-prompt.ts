import type { InsightRecord } from "@/types/nis";
import { generateSlideOutline } from "./export-slide-outline";

/**
 * 「Claude にそのまま投げるとビジュアル付きのスライド HTML / Marp / Keynote 指示 を吐く」
 * ことを想定したプロンプト。スライド骨子（テキスト）＋背景データを添付する。
 */
export function generateClaudeVisualPrompt(opts: {
  insight: InsightRecord;
  projectName: string;
  domain: string;
}): string {
  const outline = generateSlideOutline(opts);
  const { insight, projectName, domain } = opts;

  return [
    "# 指示",
    "",
    "あなたは一流の経営戦略コンサル兼プレゼンデザイナーです。",
    "以下のスライド骨子と補助データから、**ビジュアル提案込みのプレゼン草案**を作成してください。",
    "",
    "## 出力仕様",
    "",
    "各スライドについて、以下を **Markdown テーブル** で出力してください。",
    "",
    "| スライド番号 | タイトル | サブタイトル | ビジュアル提案 | レイアウト | トーク原稿（60 秒） |",
    "",
    "- 「ビジュアル提案」には、どんな図解（折れ線 / 散布 / ピラミッド / BCG マトリクス / Fish-bone / ユーザージャーニー / KPI ツリー / ICE マップ など）を、どんなデータで、どう配置するかを具体的に書いてください。",
    "- 「レイアウト」は `cover / 2-column / big-number / quadrant / timeline / kpi-tree / matrix / quote` 等から最適なものを選んでください。",
    "- 「トーク原稿」は、経営層（社長・CMO・マーケ部長）に刺さる語彙を使い、1 スライド 60 秒以内で話せる分量で書いてください。",
    "- 表に加え、スライド全体の**配色テーマ（3〜5 色）**と**推奨フォント**も冒頭で 1 行で提案してください。",
    "- 重要施策スライドは、施策ごとに独立した 1 枚にしてください。ICE 降順で並べてください。",
    "",
    "## 補助情報",
    "",
    `- 対象プロジェクト: ${projectName}（${domain}）`,
    `- 対象期間: ${insight.period.start} 〜 ${insight.period.end}`,
    `- レポート種別: ${insight.type}`,
    insight.modelProvider ? `- 初稿モデル: ${insight.modelProvider}${insight.modelVersion ? ` (${insight.modelVersion})` : ""}` : "",
    "",
    "## 禁止事項",
    "",
    "- データ裏付けのない数値を作文しないこと（骨子にない数値は推定と明記）",
    "- 一般論や曖昧な表現（「改善する」「強化する」等）を主語なしで使わないこと",
    "",
    "## スライド骨子（ソース）",
    "",
    "```",
    outline,
    "```",
    "",
    "## 出力例（参考）",
    "",
    "| 1 | ${projectName} サイト分析 2026Q1 | 事業成長を阻害する 3 つの課題と即着手すべき打ち手 | 表紙。ロゴ + 期間 + 主要 KPI 3 点（セッション / CVR / 売上）のビッグナンバー | cover | こんにちは、本日のアジェンダは... |",
    "",
    "さあ、始めてください。",
  ]
    .filter((x) => x !== "")
    .join("\n");
}
