# insight-claude Lambda

NIS の **Analyze with Claude** 用。入力は `web` の `InsightLambdaInput` と同型（集約メトリクス JSON のみ）。

## 前提

- 同じ AWS アカウントに **Amazon Bedrock** で利用可能な **Claude 3.5 Sonnet**（または指定モデル）
- Lambda 実行ロールに `bedrock:InvokeModel`（対象モデル ARN に限定推奨）

## 環境変数

| 変数 | 必須 | 例 |
|------|------|-----|
| `BEDROCK_MODEL_ID` | はい | `anthropic.claude-3-5-sonnet-20240620-v1:0` （リージョンで異なる） |
| `AWS_REGION` | 自動 | デプロイリージョン |

プロンプトは `web/src/lib/insights/stage-prompts.ts` と**内容を同期**すること。

## デプロイ手順（例）

```bash
cd lambda/insight-claude
npm install
zip -r function.zip index.mjs node_modules package.json
# AWS CLI で CreateFunction / UpdateFunctionCode、ハンドラ index.handler、Runtime nodejs20.x、Timeout 300s、Memory 1024MB 推奨
```

`index.mjs` の `export const handler` をエントリに設定（Node 20 ESM）。

## Web アプリ側

`.env` に `INSIGHT_CLAUDE_LAMBDA_FUNCTION_NAME` と、Vercel 等なら `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（`lambda:InvokeFunction` 許可の IAM ユーザー）を設定。
