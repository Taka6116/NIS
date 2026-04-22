# 設計書: Bedrock 直接呼び出しによる Claude Sonnet と Gemini 併用インサイト生成

Next.js（Vercel）から **Amazon Bedrock** を直接呼び出し、Gemini と Claude の 2 系統で同一 4 段階パイプラインを実行する構成。旧：AWS Lambda 経由の構成からマイグレーション済み（`lambda/insight-claude/` は撤去）。

## 目的

- **Generate now**: **Gemini**（`GEMINI_API_KEY`、同一 4 段階パイプライン）。
- **Analyze with Claude**: Next.js サーバーランタイムから **Amazon Bedrock Claude** を 4 段呼び出し、**同一 `InsightRecord`** を DynamoDB に保存。
- **`modelProvider`**: `gemini` | `claude` をレコードに保存し、分析一覧・詳細で識別可能。

## Web 実装

| 項目 | 場所 |
|------|------|
| 共通プロンプト | `src/lib/insights/stage-prompts.ts` |
| JSON 妥当性 | `src/lib/insights/pipeline-stage-guards.ts` |
| Bedrock 呼び出し | `src/lib/integrations/claude-bedrock.ts`（`@aws-sdk/client-bedrock-runtime`） |
| Gemini 呼び出し | `src/lib/integrations/gemini.ts` |
| 分岐生成 | `src/lib/insights/run-generate.ts` の `provider` |
| API | `POST .../insights/generate`、body `{ "provider": "gemini" \| "claude" }`（省略時 gemini） |
| UI | `insights/generate` に 2 ボタン |

### 環境変数（Web / Vercel）

- `BEDROCK_MODEL_ID` — 使用する Claude モデル ID または推論プロファイル ID。
  例（東京・クロスリージョン推論）: `apac.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `AWS_REGION`（例: `ap-northeast-1`）
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — `bedrock:InvokeModel` 権限を持つ IAM ユーザーのアクセスキー。

### IAM（最小）

Web 実行 IAM ユーザー（例: `nis-vercel`）に以下を付与。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeBedrockClaude",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "*"
    }
  ]
}
```

必要に応じて `Resource` を `arn:aws:bedrock:ap-northeast-1::foundation-model/...` や推論プロファイル ARN に絞り込む。

### Bedrock モデルアクセス

AWS コンソール → Bedrock → **Model access** で使用する Claude モデル（Sonnet 等、現行モデル）へのアクセスを有効化しておく。`Legacy` 表記のモデルは過去 30 日使用実績がないと `AccessDeniedException` を返すので、現行モデルを選ぶ。

## 制約・注意

- **無制限ではない**: Bedrock は従量課金。`max_tokens: 8192`・4 段で入出力トークンが嵩む点に注意。
- **Vercel Function タイムアウト**: Hobby 60s / Pro 300s。Claude 4 段は合計 30〜90 秒想定なので Pro 推奨。
- Cron（`api/cron/generate-insights`）は **`runInsightGeneration(projectId)` のみ** → 常に **gemini**。

## 受け入れ条件（確認用）

- [ ] Bedrock コンソールで対象 Claude モデルの Model access が有効
- [ ] Vercel 環境変数に `BEDROCK_MODEL_ID` / `AWS_*` を設定
- [ ] IAM ユーザに `bedrock:InvokeModel` 付与
- [ ] UI の「Analyze with Claude」で DynamoDB に `modelProvider: "claude"` のレコードが保存される
