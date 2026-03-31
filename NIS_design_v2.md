# NIS（Nihon Insight System）要件定義・設計書 v2.0

> 最終更新: 2026-03-31
> ステータス: 設計レビュー中
> 技術スタック: フルNext.js（パターンA）

---

## 1. プロダクト定義

### 目的

GA4 / Search Console / Microsoft Clarity のデータから課題仮説・示唆・次の一手を自動生成する意思決定支援ツール

### 提供価値

- データを見る必要がない
- 分析する必要がない
- 何をすべきかが分かる
- 行動ログ（Clarity）からUX課題も見える

### 非目的

- BIツール化（自由にグラフを作る機能は不要）
- 自由分析（SQLを書くような機能は不要）
- コンサル代替（最終判断は人間が行う）

### 差別化

3つのデータソースを横断した「クロスインサイト」を提供する。

例:
- 「検索順位は上がっているのにCVが増えない」
  → Clarityのスクロール率・Rage Clickデータと突合
  → 「ページには到達しているがCTAまで到達していない」という示唆を生成

### 設計思想

「分析ではなく意思決定のショートカット」

---

## 2. ユーザー要件

### ターゲットペルソナ

**ペルソナA: 中小企業Web担当（兼任）**
- 30-40代、総務や広報と兼任でWeb担当
- GAは見たことあるが「何を見ればいいか分からない」
- 月1回のレポート作成が苦痛
- 利用頻度: 週1回（月曜に先週分を確認）

**ペルソナB: 観光自治体の企画担当**
- 観光サイトの効果測定を求められているが知見なし
- 上長への報告資料が必要
- 利用頻度: 月2回（月初 + 月中）

**ペルソナC: NTS社内メンバー（提供側）**
- クライアントへの月次レポート・提案に使用
- 複数クライアントのデータを横断管理
- 利用頻度: 毎日

### 利用シナリオ

1. 月曜朝、NISを開く
2. KPIサマリーで先週の概況を把握（30秒）
3. インサイトカードで課題と打ち手を確認（2分）
4. 必要ならClarityリンクからセッション録画を確認（5分）
5. 打ち手をタスクとしてメモ or 共有（1分）

---

## 3. 機能要件

### 3.1 データ取得

#### Google Search Console

| 項目 | 内容 |
|------|------|
| 取得メソッド | `searchAnalytics.query` |
| メトリクス | clicks, impressions, ctr, position |
| ディメンション | query, page, device, country, date |
| 取得範囲 | 日次（2-3日遅延あり） |
| 行数上限 | 25,000行/リクエスト |
| 認証 | Service Account (JSON key) |
| 履歴保持 | GSC側16ヶ月、NIS側はDB蓄積で無制限 |

#### GA4 Data API

| 項目 | 内容 |
|------|------|
| 取得メソッド | `runReport` |
| メトリクス | sessions, activeUsers, newUsers, screenPageViews, averageSessionDuration, bounceRate, conversions, eventCount |
| ディメンション | date, pagePath, sessionSource, sessionMedium, deviceCategory, landingPage |
| 認証 | Service Account (JSON key) |
| 注意事項 | サンプリング閾値あり、大規模サイトはBigQuery Export検討 |

#### Microsoft Clarity

| 項目 | 内容 |
|------|------|
| エンドポイント | `GET https://www.clarity.ms/export-data/api/v1/project-live-insights` |
| メトリクス | Traffic, Engagement Time, Scroll Depth, Dead Click Count, Rage Click Count, Script Error Count |
| ディメンション | URL, Device, Browser, Source, Medium, Campaign, Channel, OS, Country |
| 認証 | JWT Token（Settings → Data Export から発行） |
| レート制限 | **1日10リクエスト/プロジェクト** |
| データ範囲 | **直近1-3日のみ** |
| ヒートマップ/録画 | **API取得不可** |

**Clarity制限への対策:**
- 毎日1回取得 → DB蓄積で長期トレンドを構築
- セッション録画はClarityダッシュボードへのDeep Link生成で対応

#### 取得スケジュール

| 時刻 (JST) | 処理 |
|-------------|------|
| 06:00 | GA4 日次データ取得 |
| 06:05 | GSC 日次データ取得 |
| 06:10 | Clarity 日次データ取得 |
| 毎週月曜 07:00 | 週次インサイト生成（Gemini） |

---

### 3.2 データ設計（DynamoDB）

#### テーブル: projects

| キー | 属性 | 型 |
|------|------|-----|
| PK: projectId | | S |
| | projectName | S |
| | domain | S |
| | gscPropertyUrl | S |
| | ga4PropertyId | S |
| | clarityProjectId | S |
| | clarityApiToken | S (encrypted) |
| | createdAt | S (ISO8601) |
| | updatedAt | S (ISO8601) |

#### テーブル: gsc_daily

| キー | 属性 | 型 |
|------|------|-----|
| PK: projectId | | S |
| SK: date#query#page | | S |
| | clicks | N |
| | impressions | N |
| | ctr | N |
| | position | N |
| | device | S |
| | country | S |

#### テーブル: ga4_daily

| キー | 属性 | 型 |
|------|------|-----|
| PK: projectId | | S |
| SK: date#pagePath#sourceMedium | | S |
| | sessions | N |
| | activeUsers | N |
| | newUsers | N |
| | pageViews | N |
| | avgSessionDuration | N |
| | bounceRate | N |
| | conversions | N |

#### テーブル: clarity_daily

| キー | 属性 | 型 |
|------|------|-----|
| PK: projectId | | S |
| SK: date#url | | S |
| | traffic | N |
| | engagementTime | N |
| | scrollDepth | N |
| | deadClickCount | N |
| | rageClickCount | N |
| | scriptErrorCount | N |

#### テーブル: insights

| キー | 属性 | 型 |
|------|------|-----|
| PK: projectId | | S |
| SK: generatedAt#type | | S |
| | type | S ("weekly" / "monthly" / "alert") |
| | period | M { start: S, end: S } |
| | summary | S |
| | findings | L (下記構造) |
| | topPriority | M { action: S, reason: S } |
| | rawPrompt | S (デバッグ用) |
| | modelVersion | S |
| | tokenUsage | N |

**findings 各要素の構造:**

```json
{
  "category": "seo | traffic | ux | conversion",
  "severity": "high | medium | low",
  "title": "発見のタイトル",
  "observation": "何が起きているか（数値）",
  "hypothesis": "なぜ起きているか（仮説）",
  "risk": "放置するとどうなるか",
  "actions": ["アクション1", "アクション2"],
  "expectedImpact": "期待される効果",
  "supportingData": {}
}
```

#### テーブル: users

| キー | 属性 | 型 |
|------|------|-----|
| PK: userId | | S |
| | email | S |
| | name | S |
| | role | S ("admin" / "member" / "viewer") |
| | projectIds | L |

---

### 3.3 インサイト生成エンジン

#### Step 1: ルールベース前処理（コード側）

データを集計し「異常・変化」を検出してGeminiへの入力を構成する。

**SEO系ルール:**

| 条件 | 検出内容 |
|------|---------|
| CTR < 2% かつ impressions > 100 | タイトル/メタディスクリプション改善候補 |
| impressions 前週比 +30%以上 | トレンドキーワード発見 |
| position 悪化 3位以上 | 順位下落アラート |
| clicks減 かつ impressions横ばい | CTR悪化 |
| 新規クエリ出現 | 新しい検索意図の発生 |

**トラフィック系ルール:**

| 条件 | 検出内容 |
|------|---------|
| sessions 前週比 -20%以上 | トラフィック減少アラート |
| bounceRate > 70% | ランディングページ改善必要 |
| newUsers比率の急変 | 流入構造の変化 |
| 特定source/mediumの急増減 | チャネル別分析必要 |

**UX系ルール（Clarity）:**

| 条件 | 検出内容 |
|------|---------|
| rageClickCount 前週比 +50% | UI障害の可能性 |
| scrollDepth < 30% | コンテンツ到達率低 |
| deadClickCount 高い | クリッカブルに見えるが違う要素 |
| engagementTime 低下 | コンテンツ品質の問題 |

**クロスインサイト（3データソース横断）:**

| 条件 | 示唆 |
|------|------|
| GSC順位UP + GA4セッション横ばい | CTAが弱い |
| GA4流入増 + Clarity rageClick増 | UXがボトルネック |
| GSC impressions増 + GA4 bounce増 | 検索意図と内容の不一致 |
| GA4 CV減 + Clarity scrollDepth低下 | CTA未到達 |

#### Step 2: Gemini による分析・示唆生成

**システムプロンプト:**

```
あなたはWebマーケティングの上級データアナリストです。
クライアントのWeb担当者に向けて、専門用語を避け、
具体的なアクションを提案してください。

以下のフレームワークで必ず回答してください:
1. 今週のサマリー（3行以内）
2. 重要な発見（最大5つ、severity付き）
3. 各発見について:
   a. 何が起きているか（数値の変化）
   b. なぜ起きているか（仮説）
   c. 放置するとどうなるか（リスク）
   d. 具体的に何をすべきか（アクション）
   e. 期待される効果
4. 今週の最優先アクション（1つだけ）

回答は以下のJSON形式で返してください:
{
  "summary": "...",
  "findings": [
    {
      "category": "seo|traffic|ux|conversion",
      "severity": "high|medium|low",
      "title": "...",
      "observation": "...",
      "hypothesis": "...",
      "risk": "...",
      "actions": ["...", "..."],
      "expectedImpact": "..."
    }
  ],
  "topPriority": {
    "action": "...",
    "reason": "..."
  }
}
```

**ユーザープロンプトテンプレート:**

```
以下は「{projectName}」（{domain}）の今週のデータです。

=== Search Console（{startDate}〜{endDate}）===
総クリック: {totalClicks}（前週比 {clicksChange}%）
総表示: {totalImpressions}（前週比 {impressionsChange}%）
平均CTR: {avgCtr}%（前週比 {ctrChange}pt）
平均順位: {avgPosition}（前週比 {positionChange}）

上位クエリ変動:
{queryTable}

上位ページ変動:
{pageTable}

=== GA4（{startDate}〜{endDate}）===
セッション: {sessions}（前週比 {sessionsChange}%）
ユーザー: {users}（前週比 {usersChange}%）
直帰率: {bounceRate}%（前週比 {bounceRateChange}pt）
コンバージョン: {conversions}（前週比 {conversionsChange}%）

チャネル別:
{channelTable}

ランディングページ別:
{landingPageTable}

=== Clarity（{startDate}〜{endDate}）===
エンゲージメント時間: {engagementTime}（前週比 {engTimeChange}%）
スクロール率: {scrollDepth}%（前週比 {scrollChange}pt）
Dead Click: {deadClicks}（前週比 {deadClickChange}%）
Rage Click: {rageClicks}（前週比 {rageClickChange}%）

URL別異常:
{clarityUrlTable}

=== 検出されたアラート ===
{alertsList}
```

**Gemini API設定:**

| 項目 | 値 |
|------|-----|
| モデル | gemini-2.5-pro（高精度分析）or gemini-2.0-flash（コスト優先） |
| SDKライブラリ | `@google/generative-ai` (npm) |
| レスポンス形式 | JSON（structured output） |
| トークン上限管理 | データが大きい場合はサマリーを先に作成して入力を圧縮 |

---

### 3.4 ダッシュボードUI

#### 画面一覧

| 画面 | パス | 認証 |
|------|------|------|
| ログイン | `/login` | 不要 |
| プロジェクト選択 | `/` | 必要 |
| ダッシュボード | `/projects/[id]` | 必要 |
| インサイト詳細 | `/projects/[id]/insights/[insightId]` | 必要 |
| 設定 | `/projects/[id]/settings` | admin |
| ユーザー管理 | `/admin/users` | admin |

#### ダッシュボード画面構成

```
┌─────────────────────────────────────────────────────┐
│ [NIS Logo]  プロジェクト: ▼ ABC観光協会     [設定]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  KPIサマリー（前週比カード × 4）                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │セッ   │ │CV数   │ │検索   │ │平均   │              │
│  │ション │ │      │ │表示   │ │順位   │              │
│  │1,234  │ │  23  │ │45,678│ │ 4.2  │              │
│  │+12% ↑│ │-5% ↓│ │+8% ↑│ │→    │              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
│                                                      │
│  今週の最優先アクション                               │
│  ┌──────────────────────────────────────────┐      │
│  │ [!] トップページのCTAボタンをファースト    │      │
│  │     ビュー内に移動してください              │      │
│  │     理由: Clarityのスクロール率が28%...    │      │
│  └──────────────────────────────────────────┘      │
│                                                      │
│  インサイトカード                                     │
│  ┌───────────────┐ ┌───────────────┐              │
│  │ HIGH | SEO     │ │ MEDIUM | UX   │              │
│  │「○○」の順位が │ │スマホの離脱率  │              │
│  │5位→12位に下落 │ │が急増         │              │
│  │               │ │               │              │
│  │[詳細を見る]    │ │[詳細を見る]   │              │
│  └───────────────┘ └───────────────┘              │
│                                                      │
│  トレンドグラフ（タブ切替）                           │
│  [セッション] [CV] [検索表示] [順位]                  │
│  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~            │
│  ～～～～～～～グラフエリア～～～～～～～              │
│                                                      │
│  Clarity UXスコア                                     │
│  ┌──────────────────────────────────────────┐      │
│  │ Rage Click: 23 | Dead Click: 45 | Scroll: 34% │  │
│  │ [Clarityで詳細を見る →]                   │      │
│  └──────────────────────────────────────────┘      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### UIライブラリ・チャート

| 用途 | ライブラリ |
|------|-----------|
| UIコンポーネント | Tailwind CSS + shadcn/ui |
| チャート | Recharts |
| アイコン | Lucide React |
| 日付操作 | date-fns |

---

## 4. 非機能要件

### パフォーマンス

| 指標 | 目標 |
|------|------|
| ダッシュボード初期表示 | 2秒以内 |
| インサイト生成 | 30秒以内（Gemini応答含む） |
| データ同期 | 5分以内/プロジェクト |

### 可用性

| 指標 | 目標 |
|------|------|
| 稼働率 | 99.5%（月間ダウンタイム約3.6時間まで） |
| データ取得失敗時 | 3回リトライ → Slack通知 |

### セキュリティ

| 項目 | 方針 |
|------|------|
| API Key管理 | Vercel Environment Variables |
| Service Account JSON | 暗号化保存 |
| ユーザー認証 | NextAuth.js（Google OAuth） |
| 権限管理（RBAC） | admin / member / viewer |

### コスト目安（月額・10プロジェクト以下）

| リソース | 月額 |
|---------|------|
| Vercel Pro | $20 |
| DynamoDB (on-demand) | $5-15 |
| Gemini API（週次生成 × プロジェクト数） | $10-30 |
| **合計** | **$35-65/月** |

---

## 5. システム構成

```
構成図:

[ブラウザ]
    ↓
[Next.js on Vercel]
  ├── Pages（ダッシュボードUI）
  ├── API Routes（データ取得・インサイト配信）
  └── Cron Jobs（日次同期・週次生成）
        ├── → Google Search Console API
        ├── → GA4 Data API
        ├── → Microsoft Clarity API
        ├── → Gemini API
        └── → DynamoDB (AWS)

通知:
  Cron → Slack Webhook（エラー・インサイト生成完了通知）
```

**パターンA（フルNext.js）採用理由:**
- 1プロジェクトで完結しデプロイ・運用がシンプル
- JavaScript/TypeScript のみで統一
- GA4/GSC/Gemini の JavaScript SDK が利用可能
- Vercel にデプロイすれば無料〜低コストでスタート可能
- DynamoDBだけAWSに残し、Vercelから直接アクセス

---

## 6. API設計

### エンドポイント一覧

#### プロジェクト管理

```
GET  /api/projects
  → プロジェクト一覧取得
  Response: {
    projects: [{ id, name, domain, createdAt }]
  }

POST /api/projects
  → プロジェクト新規作成 (admin)
  Body: { name, domain, gscPropertyUrl, ga4PropertyId, clarityProjectId }
  Response: { project: { id, ... } }
```

#### メトリクス

```
GET  /api/projects/:id/metrics?range=7d|30d|90d
  → KPIサマリー取得
  Response: {
    current: {
      sessions, users, conversions,
      impressions, clicks, ctr, position
    },
    previous: { ... },
    change: {
      sessions: "+12%",
      users: "+8%",
      ...
    }
  }

GET  /api/projects/:id/metrics/timeseries?metric=sessions&range=30d
  → トレンドグラフ用時系列データ
  Response: {
    metric: "sessions",
    data: [{ date: "2026-03-24", value: 1234 }, ...]
  }
```

#### インサイト

```
GET  /api/projects/:id/insights?type=weekly|monthly|alert
  → インサイト一覧取得
  Response: {
    insights: [{
      id, generatedAt, type,
      summary, findings, topPriority
    }]
  }

GET  /api/projects/:id/insights/:insightId
  → インサイト詳細取得

POST /api/projects/:id/insights/generate
  → 手動インサイト生成トリガー (admin)
  Response: { insightId, status: "generating" }
```

#### Clarity

```
GET  /api/projects/:id/clarity/dashboard-url
  → ClarityダッシュボードへのDeep Link生成
  Response: { url: "https://clarity.microsoft.com/projects/..." }
```

#### Cron（内部用）

```
POST /api/cron/sync-data
  → 日次データ同期（Vercel Cron から呼び出し）
  Header: Authorization: Bearer {CRON_SECRET}

POST /api/cron/generate-insights
  → 週次インサイト生成（Vercel Cron から呼び出し）
  Header: Authorization: Bearer {CRON_SECRET}
```

### 認証ポリシー

| エンドポイント | 認証 |
|---------------|------|
| 全 /api/* | NextAuth.js セッション必須 |
| /api/cron/* | CRON_SECRET ヘッダー検証 |
| POST系管理操作 | role = "admin" チェック |

---

## 7. Clarity制限への対応設計

### 課題

- APIリクエスト: 1日10回/プロジェクト
- データ範囲: 直近1-3日のみ
- ヒートマップ・録画: API取得不可

### 対応方針

#### 1. 日次蓄積戦略

毎朝1回 `numOfDays=1` で取得 → DB保存。
これにより長期トレンドを自前で構築。
残り9リクエストは予備・手動用。

#### 2. ディメンション取得戦略

1リクエストで3ディメンションまで指定可能:

| リクエスト | ディメンション | 目的 |
|-----------|--------------|------|
| Req 1 | URL × Device | ページ別・デバイス別パフォーマンス |
| Req 2 | Source × Medium | 流入元別パフォーマンス |
| Req 3 | Browser × OS | 技術環境別パフォーマンス |

合計 **3リクエスト/日** で主要な切り口をカバー。

#### 3. ヒートマップ・録画への導線

ClarityダッシュボードURLを動的生成:

```
https://clarity.microsoft.com/projects/{clarityProjectId}/
```

インサイトカードに「Clarityで詳しく見る」リンクを表示。

---

## 8. 開発フェーズ

### Phase 1: MVP（3週間）

**Week 1: データ基盤**
- [ ] Next.js プロジェクトセットアップ（App Router + Tailwind + shadcn/ui）
- [ ] DynamoDB テーブル作成（projects, gsc_daily, ga4_daily）
- [ ] GSC API 接続 & データ取得実装
- [ ] GA4 Data API 接続 & データ取得実装
- [ ] Vercel Cron で日次データ蓄積

**Week 2: ダッシュボードUI**
- [ ] NextAuth.js でGoogle OAuthログイン
- [ ] プロジェクト選択画面
- [ ] KPIサマリーカード（前週比表示）
- [ ] トレンドグラフ（Recharts）
- [ ] メトリクスAPI実装

**Week 3: AI統合**
- [ ] Gemini API 接続
- [ ] ルールベース前処理（アラート検出）
- [ ] プロンプトテンプレート実装
- [ ] インサイトカード表示
- [ ] MVP完了・社内テスト

### Phase 2: Clarity統合 + AI強化（2週間）

**Week 4: Clarity統合**
- [ ] Clarity API 接続 & データ取得
- [ ] clarity_daily テーブル作成
- [ ] Clarity UXスコア表示
- [ ] Clarity Deep Link生成
- [ ] クロスインサイト（3データソース横断分析）

**Week 5: 品質強化**
- [ ] プロンプト改善・チューニング
- [ ] インサイト精度検証（実データ10件以上）
- [ ] エラーハンドリング強化（リトライ・フォールバック）
- [ ] Slack通知実装

### Phase 3: マルチテナント + 運用（2週間）

**Week 6: マルチテナント**
- [ ] プロジェクト管理画面（CRUD）
- [ ] ユーザー権限管理（RBAC）
- [ ] 複数プロジェクト対応
- [ ] プロジェクト切替UI

**Week 7: リリース準備**
- [ ] パフォーマンス最適化
- [ ] 運用マニュアル作成
- [ ] クライアント向け初期セットアップフロー
- [ ] 本番リリース

---

## 9. 環境変数一覧

```env
# NextAuth
NEXTAUTH_URL=https://nis.vercel.app
NEXTAUTH_SECRET=<生成した秘密鍵>
GOOGLE_CLIENT_ID=<Google OAuth クライアントID>
GOOGLE_CLIENT_SECRET=<Google OAuth クライアントシークレット>

# Google APIs (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=<サービスアカウントメール>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<サービスアカウント秘密鍵>

# Microsoft Clarity
CLARITY_API_TOKEN=<ClarityのJWTトークン>

# Gemini
GEMINI_API_KEY=<Gemini APIキー>

# AWS DynamoDB
AWS_ACCESS_KEY_ID=<AWS アクセスキー>
AWS_SECRET_ACCESS_KEY=<AWS シークレットキー>
AWS_REGION=ap-northeast-1

# Cron Security
CRON_SECRET=<Cron認証用シークレット>

# Slack
SLACK_WEBHOOK_URL=<Slack Webhook URL>
```

---

## 10. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Clarity API 1日10リクエスト制限 | 高 | 日次蓄積 + ディメンション戦略（3req/日） |
| Gemini API の応答品質ブレ | 高 | JSON Schema指定 + バリデーション + リトライ |
| GSC データ遅延（2-3日） | 中 | UIで「最新データは○月○日分」を明示 |
| GA4 サンプリング | 中 | 小中規模サイト前提なので初期は許容 |
| DynamoDB コスト増大 | 低 | on-demandモード + TTLで古いデータ自動削除 |
| Vercel Cron の信頼性 | 低 | 失敗時Slack通知 + 手動再実行エンドポイント |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-03-31 | v1.0 | 初版作成 |
| 2026-03-31 | v2.0 | 全面改訂: Clarity追加、データ設計刷新、プロンプト設計、API詳細化、フェーズ具体化 |
