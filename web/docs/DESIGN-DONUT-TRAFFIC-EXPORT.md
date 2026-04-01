# 設計書: スクロール到達度%修正 + トラフィック分析ドーナツ + インサイトエクスポート

## 1. バグ修正: 平均スクロール到達度のドーナツ中央に `%` が表示されない

### 原因

`format="score"` では `String(Math.round(displayValue))` で `%` 無し表示になる。

### 修正

`format` に `"scorePercent"` を追加。値がすでに 0–100 のパーセンテージの場合に `%` 付きで表示。

### 変更ファイル

- `src/components/dashboard/clarity-ux-donut.tsx` — `format` 型に `"scorePercent"` 追加
- `src/app/(dashboard)/projects/[projectId]/clarity/page.tsx` — スクロール到達度を `format="scorePercent"` に変更

## 2. トラフィック分析: エンゲージメント率・直帰率のドーナツチャート化

| 指標 | maxValue | 色判定 |
|------|----------|--------|
| エンゲージメント率 | 1 | 高い = 良い。0–40%: Rose → 40–60%: Amber → 60%+: Emerald |
| 直帰率 | 1 | 低い = 良い（inverted）。0–40%: Emerald → 40–60%: Amber → 60%+: Rose |

### 変更ファイル

- `src/app/(dashboard)/projects/[projectId]/traffic/page.tsx` — 2 カードをドーナツに置換

## 3. インサイトエクスポート（スライド骨子生成）

### スライド構成

1. 表紙
2. エグゼクティブサマリー
3. 現状データ（ファクト）
4. 特定された課題（severity 順）
5. 分析から導かれた仮説（confidence 順）
6–N. 推奨アクション（priority 順、各 1 スライド）
N+1. ネクストステップ
N+2. 補足・参考データ

### 新規ファイル

- `src/lib/insights/export-slide-outline.ts` — テンプレートベースの骨子生成
- `src/components/insights/insight-export-button.tsx` — ボタン + モーダル + クリップボードコピー

### 変更ファイル

- `src/app/(dashboard)/projects/[projectId]/insights/[insightId]/page.tsx` — エクスポートボタン配置

## 4. 受け入れ条件

- [x] スクロール到達度ドーナツに `%` が表示される
- [x] トラフィック分析でエンゲージメント率・直帰率がドーナツ表示
- [x] インサイト詳細にエクスポートボタンが表示される
- [x] モーダルでスライド骨子が表示・コピーできる
- [x] 旧形式レコードでもフォールバック骨子が生成される
- [ ] `npx tsc --noEmit` と `npm run lint` がパスする
