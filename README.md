# NIS（Nihon Insight System）

- 要件・設計: [NIS_design_v2.md](./NIS_design_v2.md)
- **アプリケーション実装**: [web/README.md](./web/README.md)（Next.js プロジェクトは `web/` 配下）

ローカル起動:

**重要:** アプリの `package.json` は `web/` にあります。

```bash
# どちらでも可（A: リポジトリ直下から）
cd C:\Users\goto_\NIS
npm install:all
copy web\.env.example web\.env.local
# web\.env.local に NEXTAUTH_SECRET / NEXTAUTH_URL / GOOGLE_CLIENT_* を設定
# OAuth なしで画面だけ試す場合は login で詰まるため、最低限 NEXTAUTH_SECRET は必須
npm run dev
```

```bash
# B: web に入ってから
cd C:\Users\goto_\NIS\web
npm install
npm run dev
```

Turbopack で失敗する場合は `npm run dev:webpack`（`web` 内）または ルートで `npm run dev:webpack`。
ブラウザは **http://localhost:3000**（ポートが埋まっている場合はターミナル表示に従う）。
