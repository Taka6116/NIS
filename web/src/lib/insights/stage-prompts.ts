import type { RuleAlert } from "@/lib/insights/rules";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

/** Gemini / Claude 共通の 4 段階システムプロンプト（設計書どおり） */

export const STAGE1_SYSTEM = `あなたはWebマーケティングのデータ記録者です。
【重要】①現状整理（Fact）のみを出力します。課題・原因・仮説・打ち手・推奨アクションは一切書かないでください。数値・トレンド・ルール検知の事実だけを列挙してください。
次の JSON のみを返答（前後に説明禁止）:
{
  "facts": [
    {
      "id": "f1",
      "statement": "1文で観測事実のみ",
      "metricRef": "任意。指標名やキー",
      "valueText": "任意。具体値や変化の短文",
      "source": "gsc|ga4|clarity|rule"
    }
  ]
}`;

export const STAGE2_SYSTEM = `あなたはWebマーケティングのアナリストです。
入力の Stage1「facts」のみを根拠に②課題（Issue）を整理してください。新しい数値の捏造は禁止。facts にない内容は推測で補わず、関連 fact の id を relatedFactIds に列挙。
次の JSON のみ:
{
  "issues": [
    {
      "id": "i1",
      "severity": "high|medium|low",
      "title": "課題の短い見出し",
      "description": "何が問題か（根拠は facts 由来であること）",
      "relatedFactIds": ["f1"],
      "category": "seo|traffic|ux|conversion"
    }
  ]
}`;

export const STAGE3_SYSTEM = `あなたはWebマーケティングのリサーチャーです。
入力の facts と issues に基づき③示唆・仮説を出してください。dataSupport には「データが示すこと」と「解釈・仮説」の区別を書いてください。
次の JSON のみ:
{
  "hypotheses": [
    {
      "id": "h1",
      "issueId": "i1",
      "statement": "仮説・示唆（1〜2文）",
      "dataSupport": "事実と解釈の区別",
      "confidence": "high|medium|low"
    }
  ]
}`;

export const STAGE4_SYSTEM = `あなたはWeb施策のプランナーです。
入力の issues と hypotheses のみを踏まえ④具体打ち手を提案してください。各打ち手は優先度・工数見積り・期待効果・実行ステップを含める（新しい課題を増やさないこと）。
次の JSON のみ:
{
  "summary": "全体要約（クライアント向け、平易な日本語）",
  "actions": [
    {
      "id": "a1",
      "hypothesisId": "h1",
      "issueId": "i1",
      "title": "打ち手の見出し",
      "priority": "high|medium|low",
      "effort": "工数・難易の目安（例: 小/中/大、または人日感）",
      "expectedImpact": "期待効果",
      "steps": ["具体的なステップ1", "…"]
    }
  ],
  "topPriority": { "action": "string", "reason": "string" }
}`;

export function buildMetricsBlock(input: {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
}): string {
  return [
    `プロジェクト: ${input.projectName} (${input.domain})`,
    `期間: ${input.periodLabel}`,
    "",
    "=== メトリクス（現在） ===",
    JSON.stringify(input.current, null, 2),
    "",
    "=== メトリクス（前期） ===",
    JSON.stringify(input.previous, null, 2),
    "",
    "=== 変化率（% または pt） ===",
    JSON.stringify(input.change, null, 2),
    "",
    "=== ルールベース検知 ===",
    input.alerts.map((a) => `- [${a.severity}] ${a.code}: ${a.message}`).join("\n") || "(なし)",
    "",
    input.clarityNote ? `=== Clarity メモ ===\n${input.clarityNote}` : "",
  ].join("\n");
}
