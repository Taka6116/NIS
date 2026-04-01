# 設計書: ログイン後トランジションアニメーション

## 概要

ログイン認証成功 → ダッシュボード表示までの待ち時間にHUD風トランジション演出を追加。
CSS @keyframes + React のみ。外部ライブラリ不要。

## 3フェーズ構成（合計約2.5秒）

1. **Logo**（0–900ms）: 「NIS」ロゴ fade-in + シアンのパルスリング
2. **Status**（900–1900ms）: ステータスライン3行が順次出現（monospace）
3. **Fadeout**（1900–2400ms）: オーバーレイ fade-out → ダッシュボード fade-in

## トリガー条件

- sessionStorage `nis-just-logged-in` フラグがある場合のみ発火
- ページ遷移・リロード・URL直打ちでは表示しない
- `prefers-reduced-motion: reduce` 時はスキップ
- 画面クリックまたはキー押下で即スキップ

## 変更ファイル

- `src/components/layout/login-transition.tsx` — 新規
- `src/app/globals.css` — @keyframes 5個追記
- `src/app/(dashboard)/layout.tsx` — LoginTransition ラップ
- `src/app/(auth)/login/credentials-form.tsx` — sessionStorage フラグ設定
