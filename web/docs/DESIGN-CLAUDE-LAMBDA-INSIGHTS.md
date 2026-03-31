# 設計書: Lambda 経由 Claude Sonnet と Gemini 併用インサイト生成

本書は実装の前提と完了内容をまとめる。デプロイ手順は `lambda/insight-claude/README.md` を参照。

## 目的

- **Generate now**: 既存どおり **Gemini**（`GEMINI_API_KEY`、同一 4 段階パイプライン）。
- **Analyze with Claude**: **AWS Lambda** が **Amazon Bedrock Claude** を 4 段呼び出し、**同一 `InsightRecord`** を DynamoDB に保存。
- **`modelProvider`**: `gemini` | `claude` をレコードに保存し、分析一覧・詳細で識別可能。

## Web 実装（完了）

| 項目 | 場所 |
|------|------|
| 共通プロンプト | `src/lib/insights/stage-prompts.ts`（Gemini が import） |
| JSON 妥当性 | `src/lib/insights/pipeline-stage-guards.ts` |
| Lambda 呼び出し | `src/lib/integrations/claude-lambda.ts`（`@aws-sdk/client-lambda`） |
| 分岐生成 | `src/lib/insights/run-generate.ts` の `provider` |
| API | `POST .../insights/generate`、body `{ "provider": "gemini" \| "claude" }`（省略時 gemini） |
| UI | `insights/generate` に 2 ボタン |

### 環境変数（Web）

- `INSIGHT_CLAUDE_LAMBDA_FUNCTION_NAME` — デプロイした Lambda 名
- `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — Lambda `InvokeFunction` 可能な認証（Vercel 等）

## Lambda 実装（完了）

- ディレクトリ: `lambda/insight-claude/`
- **プロンプト**は `web/src/lib/insights/stage-prompts.ts` と**内容を同期**（`index.mjs` 内に重複記載）。
- 環境変数: **`BEDROCK_MODEL_ID`**（例は README）
- IAM: `bedrock:InvokeModel`（対象モデルに限定推奨）
- タイムアウト 300s・メモリ 1024MB 目安

## 制約・注意

- **無制限ではない**: Bedrock / Lambda は従量課金。
- Cron（`api/cron/generate-insights`）は **`runInsightGeneration(projectId)` のみ** → 常に **gemini**。

## 受け入れ条件（確認用）

- [ ] Lambda をデプロイし `BEDROCK_MODEL_ID` を設定
- [ ] Web に `INSIGHT_CLAUDE_LAMBDA_FUNCTION_NAME` と AWS 認証を設定
- [ ] UI から Analyze with Claude で Dynamo に `modelProvider: "claude"` のレコードが保存される
