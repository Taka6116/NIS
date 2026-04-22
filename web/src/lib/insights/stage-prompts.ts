import type { RuleAlert } from "@/lib/insights/rules";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

/** Gemini / Claude 共通の 4 段階システムプロンプト（設計書どおり） */

export const STAGE1_SYSTEM = `あなたはWebマーケティングのデータ記録者です。
【重要ルール】
- 出力は①現状整理（Fact）のみ。課題・原因・仮説・打ち手・推奨アクションは一切書かない。
- 入力の数値・トレンド・ルール検知の事実だけを列挙する。
- "前期" / "前年同期" / "比較期間" という語を使う場合は、必ずカレンダー日付（YYYY-MM-DD〜YYYY-MM-DD）を文中に併記する。期間が曖昧な statement は禁止。
- 入力には「期間（今期）」「期間（比較）」が記載されている。各 fact はどちらの期間の値か分かるよう "今期" / "比較期間" / "期間差分" のいずれかを statement 冒頭か metricRef に明示する。
次の JSON のみを返答（前後に説明禁止）:
{
  "facts": [
    {
      "id": "f1",
      "statement": "1文で観測事実のみ（期間と数値を必ず含める）",
      "metricRef": "任意。指標名やキー",
      "valueText": "任意。具体値や変化の短文（例: -71.6% (今期2026-03-25〜2026-04-21 vs 比較2026-02-25〜2026-03-24)）",
      "source": "gsc|ga4|clarity|rule"
    }
  ]
}`;

export const STAGE2_SYSTEM = `あなたはWebマーケティングのアナリストです。
入力の Stage1「facts」のみを根拠に②課題（Issue）を整理してください。新しい数値の捏造は禁止。facts にない内容は推測で補わず、関連 fact の id を relatedFactIds に列挙。
【重要】課題の description では、比較対象を必ず具体日付（YYYY-MM-DD〜YYYY-MM-DD）で明示し、"前期" のような曖昧な表現を単独で使わないこと。
次の JSON のみ:
{
  "issues": [
    {
      "id": "i1",
      "severity": "high|medium|low",
      "title": "課題の短い見出し",
      "description": "何が問題か（根拠は facts 由来であること、比較期間は日付で明示）",
      "relatedFactIds": ["f1"],
      "category": "seo|traffic|ux|conversion"
    }
  ]
}`;

export const STAGE3_SYSTEM = `あなたはSEO監査とデジタル戦略のシニアアナリストです。
入力の facts と issues に基づき③示唆・仮説を出してください。
【出力規則】
- MECE に 3〜6 件。
- "factorCategory" は次のいずれかから必ず選ぶ: crawl-index / technical / on-page / content-quality / authority / ux-clarity / tracking / seasonality-external。
  - crawl-index: クローラビリティ・インデックス問題（noindex/robots/sitemap/正規化）
  - technical: Core Web Vitals / レンダリング / モバイル対応 / HTTPS
  - on-page: タイトル/メタ/見出し/内部リンク/スキーマ
  - content-quality: 網羅性・鮮度・E-E-A-T・検索意図一致
  - authority: 被リンク・サイテーション・ブランド検索
  - ux-clarity: Clarity 等 UX 指標由来（dead click / rage / scroll depth / quickback）
  - tracking: GA4/GSC 設定・計測漏れ・重複セッション
  - seasonality-external: 季節性・競合・アルゴリズム更新等の外部要因
- "internalFactors" と "externalFactors" を必ず分離（自社改善可 / 不可）。内部のみ／外部のみの場合でも他方は空配列でよい。
- "mechanism" に因果チェーンを明示する（例: "CTR -2.85pt → クリック -98.4% → セッション -71.6%"）。推測と事実の切り分けは "〜と推定" を使って示す。
- "nextValidationStep" には 1 時間〜1 日以内にできる低コスト検証手段を書く（例: "GSC 画面で noindex/リダイレクト状況を1時間以内に確認"）。
- dataSupport には「データが示す事実」と「解釈・仮説」の区別を書く。
次の JSON のみ:
{
  "hypotheses": [
    {
      "id": "h1",
      "issueId": "i1",
      "statement": "仮説・示唆（1〜2文、具体的に）",
      "dataSupport": "事実と解釈の区別（事実: xxx。解釈: xxx と推定）",
      "confidence": "high|medium|low",
      "factorCategory": "crawl-index|technical|on-page|content-quality|authority|ux-clarity|tracking|seasonality-external",
      "internalFactors": ["自社で改善可能な要因の具体例"],
      "externalFactors": ["自社で改善不可な要因の具体例"],
      "mechanism": "因果チェーン",
      "nextValidationStep": "1 時間〜1 日以内の低コスト検証手段"
    }
  ]
}`;

export const STAGE4_SYSTEM = `あなたはグロース施策プランナーです。
入力の issues と hypotheses のみを踏まえ④具体打ち手を提案してください。
【出力規則】
- ICE スコア降順で最大 6 件。ICE は impact / confidence / ease（それぞれ 1-10）と score（= impact × confidence × ease / 10）を必ず返す。
- "type" は次の 3 つから選ぶ: quick-win（2 週以内・低工数） / strategic（4-8 週・中工数） / structural（8 週以上・大工数）。可能な限り type ごとに最低 1 件を含めること。
- "targetKpi" は Stage2 の issue に対応する主要指標を 1 つ指定し、direction（up/down）、targetDelta（例: "+15%" / "-0.1pt"）、timelineWeeks を必ず含める。
- "leadIndicator" は効果測定のための先行指標（例: "GSC impressions の 7 日移動平均"）。
- "risks" は実行時の副作用・リスク候補を 1〜3 件挙げる。
- "steps" は実行可能な粒度で 3〜6 ステップ。責任者/期限を明示できる表現にする（例: "内部リンク 10 本追加：該当記事→ハブページ、担当: SEO 担当、期限: 5 営業日"）。
- expectedImpact は "targetKpi" と整合させる。
- "topPriority" は ICE score が最も高い施策を選び、理由を 2 文程度でまとめる。
次の JSON のみ:
{
  "summary": "全体要約（クライアント向け、平易な日本語。期間と比較期間を日付で明示）",
  "actions": [
    {
      "id": "a1",
      "hypothesisId": "h1",
      "issueId": "i1",
      "title": "打ち手の見出し",
      "priority": "high|medium|low",
      "effort": "工数・難易の目安（例: 3 人日 / S / M / L）",
      "expectedImpact": "期待効果（targetKpi と整合）",
      "steps": ["具体的なステップ1", "具体的なステップ2", "..."],
      "type": "quick-win|strategic|structural",
      "targetKpi": {
        "metric": "sessions|clicks|ctr|avgPosition|conversions|engagementRate|...",
        "direction": "up|down",
        "targetDelta": "+15%",
        "timelineWeeks": 4
      },
      "leadIndicator": "先行指標の説明",
      "ice": { "impact": 8, "confidence": 6, "ease": 7, "score": 33.6 },
      "risks": ["副作用の例1"]
    }
  ],
  "topPriority": { "action": "string", "reason": "string" }
}`;

function formatRangeNoteDays(start: string, end: string): string {
  try {
    const s = new Date(`${start}T00:00:00Z`).getTime();
    const e = new Date(`${end}T00:00:00Z`).getTime();
    const d = Math.round((e - s) / 86_400_000) + 1;
    return `${start}〜${end}（${d}日）`;
  } catch {
    return `${start}〜${end}`;
  }
}

export function buildMetricsBlock(input: {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
  currentStart?: string;
  currentEnd?: string;
  previousStart?: string;
  previousEnd?: string;
  comparison?: "previous" | "yoy";
}): string {
  const compLabel = input.comparison === "yoy" ? "前年同期" : "直前期間";
  const periodLines: string[] = [];
  if (input.currentStart && input.currentEnd) {
    periodLines.push(`期間（今期）: ${formatRangeNoteDays(input.currentStart, input.currentEnd)}`);
  }
  if (input.previousStart && input.previousEnd) {
    periodLines.push(
      `期間（比較 / ${compLabel}）: ${formatRangeNoteDays(input.previousStart, input.previousEnd)}`,
    );
  }
  if (periodLines.length === 0) {
    periodLines.push(`期間: ${input.periodLabel}`);
  } else {
    periodLines.push(`期間ラベル: ${input.periodLabel}`);
  }

  return [
    `プロジェクト: ${input.projectName} (${input.domain})`,
    ...periodLines,
    "",
    "=== メトリクス（今期） ===",
    JSON.stringify(input.current, null, 2),
    "",
    `=== メトリクス（比較 / ${compLabel}） ===`,
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
