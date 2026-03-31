/**
 * プロンプトは web/src/lib/insights/stage-prompts.ts と同期すること。
 */
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const STAGE1_SYSTEM = `あなたはWebマーケティングのデータ記録者です。
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

const STAGE2_SYSTEM = `あなたはWebマーケティングのアナリストです。
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

const STAGE3_SYSTEM = `あなたはWebマーケティングのリサーチャーです。
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

const STAGE4_SYSTEM = `あなたはWeb施策のプランナーです。
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

function cleanJsonText(json) {
  return json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function isStage1(o) {
  return o && typeof o === "object" && Array.isArray(o.facts);
}

function isStage2(o) {
  return o && typeof o === "object" && Array.isArray(o.issues);
}

function isStage3(o) {
  return o && typeof o === "object" && Array.isArray(o.hypotheses);
}

function isStage4(o) {
  return (
    o &&
    typeof o === "object" &&
    typeof o.summary === "string" &&
    Array.isArray(o.actions) &&
    o.topPriority != null &&
    typeof o.topPriority.action === "string"
  );
}

function buildMetricsBlock(input) {
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

async function invokeStage(client, modelId, system, userContent, isT, stageLabel) {
  const run = async (content) => {
    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8192,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content }],
    };
    const cmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    });
    const res = await client.send(cmd);
    const decoded = JSON.parse(new TextDecoder().decode(res.body));
    const text = decoded.content?.[0]?.text ?? "";
    const usage = decoded.usage;
    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch {
      parsed = null;
    }
    return { parsed, raw: text, usage };
  };

  let { parsed, raw, usage } = await run(userContent);
  if (!isT(parsed)) {
    const retry = await run(
      `${userContent}\n\n※ 有効な JSON オブジェクトのみを出力し、前後に説明文を付けないでください。`,
    );
    parsed = retry.parsed;
    raw = retry.raw;
    usage = retry.usage;
  }
  if (!isT(parsed)) {
    throw new Error(`${stageLabel}: JSON schema mismatch`);
  }

  const inTok = usage?.input_tokens;
  const outTok = usage?.output_tokens;
  let tokens;
  if (typeof inTok === "number" && typeof outTok === "number") tokens = inTok + outTok;
  return { data: parsed, raw, tokens };
}

export const handler = async (event) => {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) {
    return {
      ok: false,
      errorCode: "CONFIG",
      message: "BEDROCK_MODEL_ID is not set on Lambda",
    };
  }

  let input = event;
  if (event?.body && typeof event.body === "string") {
    try {
      input = JSON.parse(event.body);
    } catch {
      return { ok: false, errorCode: "BAD_REQUEST", message: "Invalid JSON body" };
    }
  }

  if (!input || input.version !== 1) {
    return { ok: false, errorCode: "BAD_REQUEST", message: "Expected event.version === 1" };
  }

  const client = new BedrockRuntimeClient({});

  try {
    const metricsBlock = buildMetricsBlock(input);
    const s1 = await invokeStage(client, modelId, STAGE1_SYSTEM, metricsBlock, isStage1, "stage1");

    const user2 = [
      "=== Stage1 出力（facts） ===",
      JSON.stringify({ facts: s1.data.facts }, null, 2),
      "",
      "=== 参考（メトリクス要約） ===",
      `期間: ${input.periodLabel}。変化率キー例: ${Object.keys(input.change || {}).slice(0, 12).join(", ")}`,
    ].join("\n");
    const s2 = await invokeStage(client, modelId, STAGE2_SYSTEM, user2, isStage2, "stage2");

    const user3 = [
      "=== Stage1 facts ===",
      JSON.stringify({ facts: s1.data.facts }, null, 2),
      "",
      "=== Stage2 issues ===",
      JSON.stringify({ issues: s2.data.issues }, null, 2),
    ].join("\n");
    const s3 = await invokeStage(client, modelId, STAGE3_SYSTEM, user3, isStage3, "stage3");

    const user4 = [
      "=== Stage2 issues ===",
      JSON.stringify({ issues: s2.data.issues }, null, 2),
      "",
      "=== Stage3 hypotheses ===",
      JSON.stringify({ hypotheses: s3.data.hypotheses }, null, 2),
    ].join("\n");
    const s4 = await invokeStage(client, modelId, STAGE4_SYSTEM, user4, isStage4, "stage4");

    const tokenParts = [s1.tokens, s2.tokens, s3.tokens, s4.tokens].filter((t) => typeof t === "number");
    const tokenUsage = tokenParts.length ? tokenParts.reduce((a, b) => a + b, 0) : undefined;

    const raws = [
      { stage: 1, text: s1.raw },
      { stage: 2, text: s2.raw },
      { stage: 3, text: s3.raw },
      { stage: 4, text: s4.raw },
    ];
    const rawJoined = raws.map((r) => `--- stage ${r.stage} ---\n${r.text}`).join("\n\n");

    return {
      ok: true,
      pipeline: {
        facts: s1.data.facts,
        issues: s2.data.issues,
        hypotheses: s3.data.hypotheses,
        actions: s4.data.actions,
      },
      summary: s4.data.summary,
      topPriority: s4.data.topPriority,
      rawJoined,
      modelId,
      tokenUsage,
    };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      errorCode: "PIPELINE",
      message: e instanceof Error ? e.message : String(e),
    };
  }
};
