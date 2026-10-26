# サークル会計アプリ

大学生サークル向けの会計アプリ。詳細な方針は `note/方針.md`、技術スタックの決定事項は `note/技術スタック.md` を参照。

## 構成

pnpm workspace + turborepo によるモノレポ。

- `apps/web`: フロントエンド。Vite + React + React Router (Declarative) + Tailwind CSS + Tanstack Query + shadcn ui
- `apps/server`: バックエンド。Hono（Cloudflare Workers上で動作する想定）。HonoのRPC機能で `apps/web` と型を共有する
- `packages/eslint-config`: 共通ESLint設定
- `packages/typescript-config`: 共通tsconfig

認証・認可（better-auth）やDB（Cloudflare D1 + drizzle）は未実装。着手時に依存関係の追加から行う。

## セットアップ

```sh
pnpm install
```

`apps/web/.env.example` を参考に `apps/web/.env` を用意する（デフォルトで `apps/server` のローカル起動先を指すようになっている）。

## 開発

```sh
pnpm dev
```

- `apps/web`: http://localhost:3000
- `apps/server`: http://localhost:8787 (`wrangler dev`)

個別に起動する場合は `turbo dev --filter=web` / `turbo dev --filter=server` のようにフィルタを使う。

## その他のコマンド

```sh
pnpm build        # 全パッケージのビルド
pnpm lint         # 全パッケージのlint
pnpm check-types  # 全パッケージの型チェック
```
