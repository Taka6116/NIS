# 設計書: 分析ハブ（Analysis Hub）

## 1. 目的

- AI インサイト（週次生成・DynamoDB 保存）を **一覧で発見し、詳細へ到達しやすくする**。
- **Intelligence** は KPI・チャートのハブに特化し、レポート履歴は **分析** に分離して情報アーキテクチャを明確にする。
- マーケター／担当者が「どこにレポートがあるか」を迷わない導線をサイドバーに用意する。

## 2. スコープ

| 含む | 含まない |
|------|----------|
| 左サイドバー項目「分析」 | インサイト生成 API・4 段階 LLM ロジックの変更 |
| 新規ページ `/projects/{projectId}/analysis` | Reports ページの PDF 出力 |
| 既存詳細 `/projects/.../insights/{id}` へのリンク | 新しい DynamoDB テーブル |

## 3. ナビゲーション設計

### 3.1 項目順（プロジェクト内）

1. Projects（ルート）
2. Intelligence — **一致パス**: 厳密に `/projects/{id}` のみ（末尾スラッシュ無し正規化は Next の挙動に従う）。
3. **分析** — **一致パス**: `/projects/{id}/analysis` 配下 **または** `/projects/{id}/insights` 配下（一覧・生成・詳細のいずれでも「分析」がアクティブ）。
4. 以降既存（SEO、トラフィック、…）

### 3.2 Intelligence と分析の役割分担

- **Intelligence**: 同期済み KPI、グラフ、任意の「最新インサイト」スナップショット（既存 UI を維持）。
- **分析**: `listInsights` に基づく **時系列一覧**、各項目から **インサイト詳細**（4 段階タブ含む）へ遷移、**新規生成** への CTA。

### 3.3 既存 CTA の維持

- サイドバー下部 **New Analysis** → `/projects/{id}/insights/generate`（変更なし）。
- 分析ページおよび AppHeader の **Execute report** は同 URL を指す。

## 4. ページ仕様: `/projects/{projectId}/analysis`

### 4.1 データ

- `getProject(projectId)` — 404 時は `notFound()`。
- `listInsights(projectId, 50)` — 新しい順（リポジトリ既存仕様）。

### 4.2 UI

- **ヘッダ**: タイトル「分析」、サブタイトルで 4 段階レポートの説明とプロジェクト名。
- **Execute report**: `AppHeader.executeHref` で生成ページへ。
- **説明テキスト**: 週次バンドル由来であること、KPI 確認は Intelligence へのリンク。
- **主 CTA**: 「新しい分析を実行」→ `insights/generate`。
- **一覧カード**（リンク全体クリック可能）:
  - 生成日時（ja-JP 整形）、`type` バッジ、期間（`period.start` — `end`）。
  - `pipeline` あり → 「4 段階パイプライン」、なし → 「従来形式」。
  - 要約スニペット（最大 160 文字）、`topPriority.action` の一行プレビュー。
  - 右端に視覚的な「開く →」テキスト（**ネストした button は使わない** — a 内の button 回避）。
- **空状態**: 短い説明 + 「分析を開始」ボタン。

### 4.3 a11y / DOM

- インサイト行は単一の `<Link>` でラップし、内部は `<span>` のスタイルのみで補助表示。

## 5. Intelligence ページの文言

- インサイト未生成時のカードに、**サイドバー「分析」** への導線を一文追加（Execute report / New Analysis と並列）。

## 6. ファイル変更一覧（実装チェックリスト）

- [x] `src/components/layout/app-sidebar.tsx` — 分析項目、アイコン、match 調整。
- [x] `src/app/(dashboard)/projects/[projectId]/analysis/page.tsx` — 新規。
- [x] `src/app/(dashboard)/projects/[projectId]/page.tsx` — 空状態コピー更新。

## 7. 受け入れ条件

- プロジェクト選択後、サイドバーに「分析」が表示され、クリックで一覧ページが開く。
- インサイト詳細・生成ページ表示中、**Intelligence は非アクティブ**、**分析はアクティブ**。
- Intelligence トップ表示中のみ Intelligence がアクティブ。
- 一覧から詳細 URL が従来どおり `encodeURIComponent(sk)` で開く。
- ビルド・Lint が通る。
