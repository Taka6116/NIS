# 設計書: UX / Clarity ドーナツチャート化

## 1. 目的

UX / Clarity ページ上部の 6 枚の数値カード（現状テキスト表示のみ）のうち、**5 指標**をドーナツチャート付きカードに変更し、データの健全度を視覚的に直感で把握できるようにする。

## 2. 対象指標と表現方針

| # | 指標 | データソース | ドーナツの意味 | 色グラデーション |
|---|------|-------------|---------------|-----------------|
| 1 | **UX 総合スコア** | `ux.score`（0–100） | 100 点満点のうちの到達度 | 0–40: Rose → 40–70: Amber → 70–100: Emerald |
| 2 | **無反応クリック率** | `ux.deadClickRate`（0.0–1.0） | 全クリック中の無反応割合。**低いほど良好** | 0–5%: Emerald → 5–15%: Amber → 15%+: Rose |
| 3 | **連打クリック率** | `ux.rageClickRate`（0.0–1.0） | 全クリック中の連打割合。**低いほど良好** | 0–3%: Emerald → 3–10%: Amber → 10%+: Rose |
| 4 | **平均スクロール到達度** | `ux.scrollDepth`（0–100 相当） | 100% のうちの到達割合 | 0–30: Rose → 30–60: Amber → 60–100: Emerald |
| 5 | **ボットセッション率** | `ux.botTrafficRate`（0.0–1.0） | 全セッション中のボット割合。**低いほど良好** | 0–10%: Emerald → 10–30%: Amber → 30%+: Rose |

### 残り 2 指標（即戻り件数・過剰スクロール件数）

これらは「率」ではなく絶対値（件数）のため、ドーナツの「何に対する割合か」が曖昧になる。
→ **テキストカードのまま維持**し、レイアウトを下段に移動。

## 3. ドーナツチャートの共通仕様

### 3.1 ビジュアル

- **recharts** の `PieChart` + `Pie`（`innerRadius` / `outerRadius`）でドーナツ描画。
- セグメント: **値セグメント**（色付き）+ **残りセグメント**（`rgba(255,255,255,0.06)` 半透明）。
- innerRadius: 36、outerRadius: 52（カード内で適切なサイズ）。
- ドーナツ中央にパーセンテージまたはスコア値をオーバーレイ表示（絶対配置テキスト）。
- startAngle: 90、endAngle: -270（12 時位置から時計回り）。
- ツールチップ不要（シンプル表示のため中央テキストで代替）。
- アニメーション: recharts デフォルト（`isAnimationActive={true}`）。

### 3.2 色の決定ロジック

```
function donutColor(value: number, thresholds: [number, number], inverted: boolean): string
```

- `inverted = false`（高い = 良い）: score, scrollDepth
  - value < thresholds[0] → Rose (`#f43f5e`)
  - value < thresholds[1] → Amber (`#f59e0b`)
  - value >= thresholds[1] → Emerald (`#10b981`)
- `inverted = true`（低い = 良い）: deadClickRate, rageClickRate, botTrafficRate
  - value < thresholds[0] → Emerald
  - value < thresholds[1] → Amber
  - value >= thresholds[1] → Rose

### 3.3 レスポンシブ

- グリッド: `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`（ドーナツ 5 枚を横並び）。
- 各カード内: ドーナツ（上部 or 左）+ ラベル・数値（下部 or 右）。
- `min-h` で高さ揃え。

## 4. コンポーネント設計

### 4.1 新規ファイル

| ファイル | 種別 | 説明 |
|---------|------|------|
| `src/components/dashboard/clarity-ux-donut.tsx` | Client Component | 汎用ドーナツ 1 個分。props: `value`, `maxValue`, `label`, `sublabel`, `format`, `thresholds`, `inverted` |

### 4.2 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/(dashboard)/projects/[projectId]/clarity/page.tsx` | 上部 6 枚カード → ドーナツ 5 枚 + テキストカード 2 枚にレイアウト変更 |

## 5. Props 定義（`ClarityUxDonut`）

```ts
type ClarityUxDonutProps = {
  /** 表示する値（例: 72, 0.034） */
  value: number;
  /** ドーナツの最大値（100 or 1.0）。fillRatio = value / maxValue */
  maxValue: number;
  /** 英語ラベル（上段小文字） */
  label: string;
  /** 日本語ラベル（2段目） */
  sublabel: string;
  /** 中央テキストのフォーマット（"score" → そのまま, "percent" → ×100 + %） */
  format: "score" | "percent";
  /** 色判定しきい値 [low, high]。format="percent" の場合は % 換算後の値で判定 */
  thresholds: [number, number];
  /** true = 低いほど良い（率系指標） */
  inverted?: boolean;
  /** カード下部の補助テキスト */
  description?: string;
};
```

## 6. Clarity ページのレイアウト変更

### 変更前（現行）

```
Row 1: [Score] [Dead click] [Rage click] [Scroll] [Quickback] [Excessive]
                          (6 cols, all text cards)
Row 2: [Pageviews] [Users] [Bot rate]
                          (3 cols, text cards)
```

### 変更後

```
Row 1: 🍩Score  🍩Dead click  🍩Rage click  🍩Scroll depth  🍩Bot rate
                          (5 cols, donut cards)
Row 2: [Quickback件数] [過剰スクロール件数] [Pageviews] [Users]
                          (4 cols, text cards)
```

ボットセッション率は Row 1 のドーナツに昇格し、Pageviews/Users は Row 2 に移動。

## 7. ファイル変更チェックリスト

- [ ] `src/components/dashboard/clarity-ux-donut.tsx` — 新規作成
- [ ] `src/app/(dashboard)/projects/[projectId]/clarity/page.tsx` — レイアウト変更
- [ ] ビルド・Lint 通過

## 8. 受け入れ条件

1. Clarity ページ上部にドーナツチャート 5 つが表示される。
2. 各ドーナツ中央にスコア値またはパーセンテージが表示される。
3. 色がしきい値に応じて Emerald / Amber / Rose で変化する。
4. 即戻り件数・過剰スクロール件数はテキストカードのまま維持。
5. レスポンシブ: モバイルでは 1 列、md で 2 列、lg で 3 列、xl で 5 列。
6. `npx tsc --noEmit` と `npm run lint` がパスする。
7. 既存のページ別内訳テーブル・参照元テーブルに影響なし。
