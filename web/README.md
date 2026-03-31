# NIS Web (Nihon Insight System)

Next.js ダッシュボード — 設計は [../NIS_design_v2.md](../NIS_design_v2.md) を参照。

実装はリポジトリ直下の `skills/` などと共存するため、アプリは **`web/` サブフォルダ**にあります。

## 開発

親フォルダ `NIS/` からでも `npm run dev` できます（`npm --prefix web` で委譲）。

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Turbopack で落ちる環境では `npm run dev:webpack` を試してください。

ブラウザ: http://localhost:3000

### よくあるエラー

- **`npm run dev` で「スクリプトがない」「package.json がない」** → カレントが `web/` ではないか、`C:\Users\goto_\NIS` 直下の `package.json` を使って `npm run dev` してください。
- **`EADDRINUSE` / ポート使用中** → 他の Next を終了するか `npx next dev -p 3001`（`web` 内で `-- -p 3001`）。
- **ログイン画面以降でエラー** → `.env.local` に `NEXTAUTH_SECRET`（32文字以上のランダム文字列）と `NEXTAUTH_URL=http://localhost:3000`、Google OAuth 用の Client ID/Secret が必要です。

## 環境変数

`.env.example` を参照。Google / Search Console / GA4 / Clarity / Gemini / DynamoDB / NextAuth を設定してください。

**機密情報方針**: Service Account JSON と Clarity JWT は Vercel の暗号化環境変数に置くか、DynamoDB 保存時は KMS 等での暗号化を前提にしてください（本リポジトリは平文での長期保存を推奨しません）。

## DynamoDB テーブル

設計書 §3.2 のキー設計に合わせたテーブルを作成してください。初期セットアップ手順は後続の IaC または AWS コンソール作業を想定しています。

## 本番デプロイ

Vercel 想定。`vercel.json` の Cron エントリと `CRON_SECRET` を設定してください。
