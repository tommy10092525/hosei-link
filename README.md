# HoseiLink

法政大学の学生専用 SNS。投稿・DM・フォロー・リアクションといった一般的な SNS 機能に加え、
シラバスから収集した授業（12,940件）を履修登録することで、**同じ授業を取っている学生同士が交流できる**。

## 主な機能

- タイムライン（投稿・画像添付・リアクション・返信）
- DM（1対1チャット）と授業ごとのクラスチャット
- フォロー / 公開・非公開アカウント
- 授業検索（曜日・時限での絞り込み）と履修登録、時間割表示
- 授業ごとの履修者一覧と授業レビュー
- ブロック・通報・お問い合わせフォーム
- 大学メールアドレス (`@stu.hosei.ac.jp`) による magic link ログイン（パスワード無し）

## 技術スタック

pnpm workspace + turborepo のモノレポ。Cloudflare Workers 1本で API と SPA の両方を配信する。

| パッケージ | 内容 |
|---|---|
| `apps/web` | Vite + React + React Router (hash router) + TanStack Query + Tailwind CSS + shadcn/ui |
| `apps/server` | Hono on Cloudflare Workers。D1 + drizzle、R2（画像）、Email Sending（magic link）、better-auth |
| `packages/eslint-config` | 共通 ESLint 設定 |
| `packages/typescript-config` | 共通 tsconfig |

`apps/web` は Hono RPC で `apps/server` の型を直接参照しており、コード生成は行っていない。
アーキテクチャ上の制約や設計判断の詳細は [CLAUDE.md](CLAUDE.md) を参照。

## セットアップ

```sh
pnpm install

# Cloudflare バインディングの型を生成（gitignore 済みのため clone 直後に必須）
pnpm --filter server exec wrangler types

# ローカル用の設定を作成し、BETTER_AUTH_SECRET などを埋める
cp apps/server/.dev.vars.example apps/server/.dev.vars

# ローカル D1 にマイグレーションを適用
pnpm db:migrate:local
```

### 授業データの投入

元データ (`t.json`) は旧リポジトリの `scraping/` にある。

```sh
cd apps/server
pnpm exec tsx scripts/seed-classes.ts <t.json のパス>
pnpm exec wrangler d1 execute hoseilink-d1 --local --file drizzle/seed/classes.sql
```

旧サービスのデータ復元手順は [CLAUDE.md](CLAUDE.md) の「旧 Neon DB からのデータ復元」を参照。

## 開発

```sh
pnpm dev
```

- http://localhost:3000 — vite（**普段はこちらを開く**。`/api` と `/auth` は :8787 にプロキシされる）
- http://localhost:8787 — `wrangler dev`（ビルド済みの `apps/web/dist` を配信するため HMR は効かない）

開発中は magic link のメールを送らず、リンクを wrangler のログに出力する。
実際に送信したい場合は `.dev.vars` で `DEV_SEND_EMAIL="true"` にする。

## コマンド

```sh
pnpm build              # 全パッケージのビルド
pnpm lint               # lint
pnpm check-types        # 型チェック
pnpm deploy             # ビルドして wrangler deploy

pnpm db:generate        # スキーマ変更後にマイグレーションを生成
pnpm db:migrate:local   # ローカル D1 に適用
pnpm db:migrate:remote  # 本番 D1 に適用
```

本番のシークレットは `apps/server` で `pnpm exec wrangler secret put <NAME>` を使って設定する。
