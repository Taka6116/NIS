# NIS セットアップガイド

> このガイドは、NIS（Nihon Insight System）をローカル開発から本番デプロイまで段階的にセットアップする手順書です。  
> 設計書: `NIS_design_v2.md` に準拠

---

## 目次

1. [ローカル確認（今すぐ）](#step-1-ローカル確認今すぐ)
2. [GitHub リポジトリ作成](#step-2-github-リポジトリ作成)
3. [Google OAuth 設定（ログイン用）](#step-3-google-oauth-設定ログイン用)
4. [Google Service Account 作成（GSC・GA4 API 用）](#step-4-google-service-account-作成gscga4-api-用)
5. [Gemini API キー取得](#step-5-gemini-api-キー取得)
6. [Microsoft Clarity API トークン取得](#step-6-microsoft-clarity-api-トークン取得)
7. [AWS DynamoDB テーブル作成](#step-7-aws-dynamodb-テーブル作成)
8. [Vercel プロジェクト作成 & デプロイ](#step-8-vercel-プロジェクト作成--デプロイ)
9. [Vercel 環境変数設定](#step-9-vercel-環境変数設定)
10. [Slack 通知設定（任意）](#step-10-slack-通知設定任意)
11. [動作確認チェックリスト](#step-11-動作確認チェックリスト)

---

## Step 1: ローカル確認（今すぐ）

すでにコードは完成しています。まずはローカルで画面を確認しましょう。

```powershell
cd C:\Users\goto_\NIS\web
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開くと、ログイン画面が表示されます。  
**「開発モードで続行（OAuth 不要）」** ボタンが表示されるのでクリックすると、ダッシュボードへ遷移できます。

> `.env.local` は自動生成済みです。`NIS_DEV_BYPASS_AUTH=1` と `NIS_USE_MOCK_DB=1` が設定されているため、Google OAuth や AWS なしで動作します。

---

## Step 2: GitHub リポジトリ作成

### 2-1. GitHub でリポジトリ作成

1. https://github.com/new を開く
2. Repository name: `NIS`（または `nihon-insight-system`）
3. Private リポジトリを選択
4. 「Create repository」をクリック

### 2-2. ローカルから Push

```powershell
cd C:\Users\goto_\NIS
git init
git add .
git commit -m "Initial commit: NIS v1.0"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/NIS.git
git push -u origin main
```

> `.gitignore` はすでに `web/` 内に配置済みですが、ルートにも必要なら追加してください。  
> `.env.local` は `.gitignore` に含まれているため、Push されません。

---

## Step 3: Google OAuth 設定（ログイン用）

NIS のログイン画面で「Google で続行」を使うために必要です。

### 3-1. Google Cloud Console

1. https://console.cloud.google.com/ を開く
2. プロジェクトを作成（例: `NIS`）
3. **APIとサービス** → **OAuth 同意画面** → **外部** を選択して作成
   - アプリ名: `NIS`
   - ユーザーサポートメール: 自分のメール
   - スコープ: `email`, `profile`, `openid` を追加
4. **APIとサービス** → **認証情報** → **認証情報を作成** → **OAuth クライアントID**
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 名前: `NIS Web`
   - 承認済みの JavaScript 生成元:
     - `http://localhost:3000`（ローカル用）
     - `https://nis.vercel.app`（本番用。Step 8 で確定後に追加）
   - 承認済みのリダイレクト URI:
     - `http://localhost:3000/api/auth/callback/google`（ローカル用）
     - `https://nis.vercel.app/api/auth/callback/google`（本番用）

### 3-2. 取得した値をローカルに設定

`web/.env.local` を開き、以下を設定:

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

設定後、`NIS_DEV_BYPASS_AUTH=1` をコメントアウトすれば Google ログインで動作確認できます。

---

## Step 4: Google Service Account 作成（GSC・GA4 API 用）

ダッシュボードのデータ取得に使います（OAuth ログインとは別物）。

### 4-1. サービスアカウント作成

1. Google Cloud Console → **IAMと管理** → **サービスアカウント**
2. **サービスアカウントを作成**
   - 名前: `nis-data-reader`
   - ロール: 不要（APIレベルで権限付与するため）
3. 作成したサービスアカウントの **キー** タブ → **鍵を追加** → **新しい鍵を作成** → **JSON**
4. ダウンロードされた JSON を安全な場所に保存

### 4-2. Search Console で権限付与

1. https://search.google.com/search-console を開く
2. 対象プロパティ → **設定** → **ユーザーと権限** → **ユーザーを追加**
3. サービスアカウントのメール（例: `nis-data-reader@nis-xxxxxx.iam.gserviceaccount.com`）を追加
4. 権限: **フル**（または制限付きでも可）

### 4-3. GA4 で権限付与

1. https://analytics.google.com/ を開く
2. **管理** → 対象プロパティの **プロパティのアクセス管理**
3. 右上「+」→ **ユーザーを追加** → サービスアカウントのメール
4. 権限: **閲覧者**

### 4-4. 環境変数に設定

ダウンロードした JSON の中から必要な値を `.env.local` に設定:

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"nis-data-reader@...","token_uri":"https://oauth2.googleapis.com/token"}
```

> JSON を1行にして丸ごと貼り付けてください。改行は `\n` のまま残します。  
> 本番では Vercel 環境変数に同じ値を設定します。

---

## Step 5: Gemini API キー取得

AI インサイト生成に使います。

### 5-1. API キー取得

1. https://aistudio.google.com/app/apikey を開く
2. **Create API Key** → プロジェクトを選択して作成
3. 表示されたキーをコピー

### 5-2. 環境変数に設定

```env
GEMINI_API_KEY=AIzaSy...
```

> 無料枠（Free tier）で十分スタートできます。週次生成であれば月の呼び出し回数は少ないです。

---

## Step 6: Microsoft Clarity API トークン取得

### 6-1. Clarity プロジェクトの確認

1. https://clarity.microsoft.com/ にログイン
2. 対象プロジェクトの **Project ID** をメモ（URL の `https://clarity.microsoft.com/projects/view/XXXXXXX` の部分）

### 6-2. API トークン取得

1. Clarity ダッシュボード → **Settings** → **Data Export**
2. API Token をコピー

### 6-3. 環境変数に設定

```env
CLARITY_API_TOKEN=eyJhbGciOi...（JWT形式のトークン）
CLARITY_PROJECT_ID=xxxxxxx
```

> Clarity API は 1日10リクエスト制限があります。NIS は日次で3リクエスト（異なるディメンション）を想定しています。

---

## Step 7: AWS DynamoDB テーブル作成

### 7-1. AWS アカウント準備

AWS アカウントがない場合は https://aws.amazon.com/ で作成してください。

### 7-2. IAM ユーザー作成

1. AWS Console → **IAM** → **ユーザー** → **ユーザーを追加**
2. ユーザー名: `nis-dynamo-user`
3. **アクセスキー - プログラムによるアクセス** にチェック
4. ポリシーを直接アタッチ:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-1:*:table/nis-*",
        "arn:aws:dynamodb:ap-northeast-1:*:table/nis-*/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::nis-kw-datasets",
        "arn:aws:s3:::nis-kw-datasets/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```

5. アクセスキー ID とシークレットアクセスキーをメモ

### 7-3. DynamoDB テーブル作成

AWS Console → **DynamoDB** → リージョン `ap-northeast-1`（東京）で以下のテーブルをすべて作成:

| テーブル名 | Partition Key | Sort Key | TTL 属性 | 備考 |
|---|---|---|---|---|
| `nis-projects` | `projectId` (S) | ― | ― | プロジェクト設定 |
| `nis-gsc-daily` | `projectId` (S) | `sk` (S) | ― | GSC 日次データ |
| `nis-ga4-daily` | `projectId` (S) | `sk` (S) | ― | GA4 日次データ |
| `nis-clarity-daily` | `projectId` (S) | `sk` (S) | ― | Clarity スナップショット |
| `nis-insights` | `projectId` (S) | `sk` (S) | `expiresAt` | AI インサイト（Draft は TTL 付き） |
| `nis-users` | `userId` (S) | ― | ― | ユーザー管理 |
| `nis-action-tracking` | `projectId` (S) | `sk` (S) | ― | 打ち手トラッキング (B1) |
| `nis-project-alerts` | `projectId` (S) | `sk` (S) | ― | アラート設定 (B8) |
| `nis-insight-shares` | `projectId` (S) | `sk` (S) | ― | 共有トークン (B7) |

> **課金モード**: すべて「オンデマンド（PAY_PER_REQUEST）」を選択  
> **TTL**: `nis-insights` テーブルに TTL 属性 `expiresAt`（epoch seconds）を設定する

#### GSI 推奨設定（パフォーマンス改善）

`nis-users` テーブルに Email による検索用 GSI を追加することを推奨:

| テーブル | GSI 名 | Partition Key |
|---|---|---|
| `nis-users` | `EmailIndex` | `email` (S) |

GSI がない場合はフルスキャンにフォールバックしますが、ユーザー数が増えるにつれて低速になります。

### 7-4. S3 バケット作成

キーワードデータセット（Ahrefs CSV）の保存に使用:

| バケット名 | 用途 |
|---|---|
| `nis-kw-datasets` | キーワード CSV ストレージ |

```bash
aws s3api create-bucket \
  --bucket nis-kw-datasets \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1
```

### 7-5. AWS CLI で DynamoDB テーブルを一括作成する場合（任意）

```bash
for TABLE in nis-projects nis-users; do
  aws dynamodb create-table --table-name $TABLE \
    --attribute-definitions AttributeName=projectId,AttributeType=S \
    --key-schema AttributeName=projectId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST --region ap-northeast-1
done

# projectId + sk 構造のテーブル
for TABLE in nis-gsc-daily nis-ga4-daily nis-clarity-daily nis-insights nis-action-tracking nis-project-alerts nis-insight-shares; do
  aws dynamodb create-table --table-name $TABLE \
    --attribute-definitions \
      AttributeName=projectId,AttributeType=S \
      AttributeName=sk,AttributeType=S \
    --key-schema \
      AttributeName=projectId,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST --region ap-northeast-1
done

# nis-users だけは userId がPK
aws dynamodb create-table --table-name nis-users \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=email,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region ap-northeast-1 \
  --global-secondary-indexes '[{
    "IndexName":"EmailIndex",
    "KeySchema":[{"AttributeName":"email","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}
  }]'

# nis-insights の TTL 設定
aws dynamodb update-time-to-live \
  --table-name nis-insights \
  --time-to-live-specification Enabled=true,AttributeName=expiresAt \
  --region ap-northeast-1
```

### 7-6. 環境変数に設定

```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxxxx...

# S3
NIS_S3_BUCKET_KW_DATASETS=nis-kw-datasets

# 追加テーブル（デフォルト名と変える場合のみ）
# NIS_TABLE_ACTION_TRACKING=nis-action-tracking
# NIS_TABLE_PROJECT_ALERTS=nis-project-alerts
# NIS_TABLE_INSIGHT_SHARES=nis-insight-shares
```

この時点で `.env.local` の `NIS_USE_MOCK_DB=1` をコメントアウトすると実際の DynamoDB に接続します。

---

## Step 8: Vercel プロジェクト作成 & デプロイ

### 8-1. Vercel アカウント

https://vercel.com/ でアカウントを作成（GitHub 連携推奨）

### 8-2. プロジェクトのインポート

1. Vercel ダッシュボード → **Add New...** → **Project**
2. GitHub リポジトリ `NIS` を選択
3. **Framework Preset**: `Next.js`
4. **Root Directory**: `web` に変更（重要！）
5. **Deploy** をクリック

> 初回デプロイは環境変数未設定のため失敗する可能性があります。Step 9 で環境変数を設定してから再デプロイしてください。

### 8-3. カスタムドメイン（任意）

Vercel のプロジェクト設定 → **Domains** → カスタムドメインを追加  
（なければ `xxx.vercel.app` のデフォルトドメインを使用）

---

## Step 9: Vercel 環境変数設定

Vercel ダッシュボード → プロジェクト → **Settings** → **Environment Variables**

以下をすべて追加:

| 変数名 | 値 | 必須 |
|---|---|---|
| `NEXTAUTH_URL` | `https://あなたのドメイン.vercel.app` | ✅ |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成した値 | ✅ |
| `GOOGLE_CLIENT_ID` | Step 3 で取得 | ✅ |
| `GOOGLE_CLIENT_SECRET` | Step 3 で取得 | ✅ |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Step 4 の JSON（1行） | ✅ |
| `GEMINI_API_KEY` | Step 5 で取得 | ✅ |
| `CLARITY_API_TOKEN` | Step 6 で取得 | ⬜ 後でも可 |
| `CLARITY_PROJECT_ID` | Step 6 で取得 | ⬜ 後でも可 |
| `AWS_REGION` | `ap-northeast-1` | ✅ |
| `AWS_ACCESS_KEY_ID` | Step 7 で取得 | ✅ |
| `AWS_SECRET_ACCESS_KEY` | Step 7 で取得 | ✅ |
| `CRON_SECRET` | 任意のランダム文字列（32文字以上推奨） | ✅ |
| `SLACK_WEBHOOK_URL` | Step 10 で取得 | ⬜ 任意 |
| `NIS_ADMIN_EMAILS` | 管理者メールアドレス（カンマ区切り） | ✅ |
| `NIS_S3_BUCKET_KW_DATASETS` | `nis-kw-datasets`（Step 7-4 で作成） | ✅ |
| `NIS_TABLE_ACTION_TRACKING` | `nis-action-tracking`（デフォルト変える場合のみ） | ⬜ 任意 |
| `NIS_TABLE_PROJECT_ALERTS` | `nis-project-alerts`（デフォルト変える場合のみ） | ⬜ 任意 |
| `NIS_TABLE_INSIGHT_SHARES` | `nis-insight-shares`（デフォルト変える場合のみ） | ⬜ 任意 |

> `NEXTAUTH_SECRET` の生成:
> ```bash
> openssl rand -base64 32
> ```
> または PowerShell:
> ```powershell
> [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }) -as [byte[]])
> ```

設定後、**Deployments** → 最新のデプロイの右メニュー → **Redeploy** で再デプロイ

---

## Step 10: Slack 通知設定（任意）

Cron ジョブの成功/失敗通知を Slack で受け取れます。

### 10-1. Slack Webhook 作成

1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. アプリ名: `NIS通知`、ワークスペースを選択
3. **Incoming Webhooks** → **On** に切り替え
4. **Add New Webhook to Workspace** → 通知先チャンネルを選択
5. 表示された Webhook URL をコピー

### 10-2. 環境変数に設定

Vercel と `.env.local` 両方に:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx...
```

---

## Step 11: 動作確認チェックリスト

### ローカル

- [ ] `npm run dev` でエラーなく起動する
- [ ] 開発バイパスまたは Google ログインで認証通過
- [ ] プロジェクト一覧画面が表示される
- [ ] 新規プロジェクトが作成できる
- [ ] プロジェクトの Intelligence ダッシュボードが表示される

### 本番（Vercel）

- [ ] デプロイが成功する（Build Logs でエラーなし）
- [ ] `https://ドメイン/login` で Google ログインできる
- [ ] プロジェクト作成 → ダッシュボード表示
- [ ] Settings でデータソース接続情報を設定
- [ ] 手動 Sync（Data Sources 画面の「同期実行」）でデータ取得成功
- [ ] Insight 生成画面で AI 分析が実行される
- [ ] Vercel Cron Logs に日次/週次ジョブの実行ログが出る

---

## トラブルシューティング

### `npm run dev` でエラーが出る

```
MissingSecret: Please define a "secret"
```
→ `web/.env.local` に `NEXTAUTH_SECRET` が設定されているか確認

### AWS の CredentialsProviderError

→ `NIS_USE_MOCK_DB=1` が設定されているか確認（ローカル開発用）

### Turbopack でコンパイルエラーが出る

→ `npm run dev:webpack` で Turbopack を無効にして試す

### Vercel デプロイでビルドエラー

→ Root Directory が `web` になっているか確認

### Google ログインで 400 エラー

→ OAuth の「承認済みのリダイレクト URI」に本番 URL が含まれているか確認

---

## 全体の推奨進行順序

```
Phase 0: ローカル確認           ← 今ここ（Step 1）
    ↓
Phase 1: GitHub + Vercel       ← Step 2, 8
    ↓
Phase 2: Google OAuth          ← Step 3（ログインが動く状態に）
    ↓
Phase 3: AWS DynamoDB          ← Step 7（インメモリ → 本物のDBへ）
    ↓
Phase 4: GSC + GA4 連携        ← Step 4（実データ取得可能に）
    ↓
Phase 5: Gemini AI             ← Step 5（インサイト生成が動く）
    ↓
Phase 6: Clarity 連携          ← Step 6（UXデータも取得）
    ↓
Phase 7: Slack 通知 + 運用     ← Step 10 → 本番運用開始
```

> Lambda は不要です。NIS はフルNext.js構成で、Vercel の Serverless Functions + Cron Jobs ですべてまかなう設計です。  
> AWS は DynamoDB のみ使用します。
