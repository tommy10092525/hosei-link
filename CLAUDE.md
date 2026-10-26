# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**HoseiLink** — 法政大学の学生専用 SNS。投稿・DM・フォロー・リアクションといった一般的な SNS 機能に加え、
サービス上に既に登録されている授業（シラバスから収集した12,940件）を履修登録することで、
**同じ授業を取っている学生同士が交流できる**のが中心的な価値。UI は日本語。

`programs/cloudflare-drizzle-neon` にある Next.js 15 + OpenNext + Neon Postgres 版の作り替え先。
旧実装の課題（データ取得方法が3系統に分裂、API の型がクライアントに伝わらない、
5.8MB の授業 JSON をクライアントバンドルに同梱、自作の認証フロー）を解消することが目的。

## Commands

pnpm workspace + turborepo (`pnpm@9`, Node >=18)。原則リポジトリルートから実行する。

```sh
pnpm install
pnpm dev            # web (:3000, vite) と server (:8787, wrangler dev) を並走
pnpm build          # 各パッケージの build
pnpm check-types    # tsc --noEmit
pnpm lint
pnpm deploy         # build してから wrangler deploy

# データベース (D1)
pnpm db:generate        # スキーマ変更後にマイグレーション生成
pnpm db:migrate:local
pnpm db:migrate:remote

# 単一パッケージ
pnpm exec turbo dev --filter=web
pnpm --filter server add <pkg>
```

**開発は :3000 (vite) を開く。** :8787 を直接開いても動くが、その場合フロントは
ビルド済みの `apps/web/dist` が配信されるので HMR が効かない。

## Architecture

### 単一 Worker + 同一オリジン

`apps/server` の Worker が **API と SPA の両方**を配信する。

- `wrangler.jsonc` の `assets` バインディングが `../web/dist` を配信
- `run_worker_first: ["/api/*", "/auth/*"]` でその2つだけ Hono に流れる
- dev では vite の `server.proxy` が `/api` と `/auth` を :8787 に転送する。
  **この proxy は `changeOrigin: true` が必須。** false だと Host が localhost:3000 のまま
  転送され、`wrangler dev` が「ローカル宛ではない」と判断して wrangler.jsonc の
  `routes` (custom_domain) にマッピングし、リクエストURLのホストを本番ドメインへ
  書き換えてしまう。すると better-auth の origin チェックが
  `http://hosei-link.koki-tominaga.cc` を見て 403 INVALID_ORIGIN になり、
  ローカルでログインできなくなる

**この構成のおかげで CORS 設定も `VITE_API_URL` も不要**で、better-auth の Cookie が
`SameSite=Lax` のまま素通しで効く。この前提を壊す変更（web を別オリジンにデプロイする等）は
認証の作り直しを伴うので注意。

ルーティングは **hash router**。ASSETS 配信でパスごとのフォールバック設定が要らなくなるため。

### Hono RPC による型共有（壊しやすいので必読）

`apps/web` は `apps/server` の TypeScript ソースを直接型として読む。コード生成は無い。

- `apps/server/package.json` の `exports` が `./src/index.ts` を指す（ビルド無し）
- `apps/web` は `server` を `workspace:*` の **devDependency** として持つ
- 解決できるのは両者が `moduleResolution: "Bundler"` だから

**破りやすい制約:**

1. **ルートは単一の `new Hono()` からメソッドチェーンで生やすこと。**
   `const app = new Hono(); app.get(...)` のように文を分けると `AppType` から型が落ちる。
2. **バリデーションは `src/validator.ts` の `validator()` を使う**（素の `zValidator` ではなく）。
   素の zValidator は失敗時に Zod のエラーを JSON で返すため、RPC の戻り値型が
   `ZodSafeParseError<...> | 実際のレスポンス` というユニオンになってしまう。
   ラッパーは `HTTPException` を投げるので、型は成功時の形だけになり、
   エラー応答も `onError` の `{ error: string }` に統一される。
3. **`apps/web/tsconfig.json` の include に `../server/worker-configuration.d.ts` がある。**
   web の tsc はサーバ実装まで型チェックするので、Cloudflare の型が必要になる。
   このファイルは `wrangler types` の生成物（gitignore 済み）なので、
   **clone 直後は `pnpm --filter server exec wrangler types` を実行しないと型チェックが落ちる。**
   `wrangler.jsonc` のバインディングを変えたときも再生成すること。

### バインディング

`env` はリクエストスコープなので、Next.js 版のようにモジュールのトップレベルで
db や auth のインスタンスを作れない。ハンドラごとに `getDb(c.env)` / `createAuth(c.env)` で生成する。

| バインディング | 用途 |
|---|---|
| `DB` (D1) | `src/db/index.ts` の `getDb(env)` |
| `BUCKET` (R2) | 画像。`src/storage.ts` |
| `EMAIL` (Email Sending) | magic link の送信。`src/mail.ts` |
| `ASSETS` | SPA の配信 |

シークレットは `.dev.vars`（ローカル、gitignore）と `wrangler secret put`（本番）。
`.dev.vars.example` を参照。`.dev.vars` のキーはローカル実行時 `wrangler.jsonc` の `vars` より優先される。

### 認証 (better-auth)

magic link のみ。パスワードは持たない。

- 大学ドメイン (`@stu.hosei.ac.jp`) と運営の許可リスト以外は弾く。
  **判定は `hooks.before` で行う**（`sendMagicLink` の中だと verification 行が作られた後になるため）
- **アプリ固有のユーザー属性は全て `input: false`。** `/api/profile` 経由でしか更新させず、
  サインアップのボディに `public: true` などを混ぜて注入されるのを防ぐ
- **新規ユーザーは非公開 (`public: false`) で始まる**
- `requireAuth` ミドルウェアで `c.get("user")` が使えるようになる
- **dev / 本番の切り替えは `APP_ENV`** (`.dev.vars` で `"development"`、wrangler.jsonc の
  vars で `"production"`)。BASE_URL の文字列から推測しないこと。推測にすると
  `.dev.vars` が読まれなかったときに黙って本番扱いになり、
  **ローカル作業中に本番URLのメールが実際に飛ぶ**
- magic link のリンク先は `BASE_URL` から組み立てられる (dev は localhost:3000、
  本番は独自ドメイン)。発行のたびに `[auth] magic link mode=... baseURL=...` を
  ログに出しているので、設定ミスはそこで気づける
- 開発中は既定でメールを送らず URL をログに出すだけ。
  到達まで確かめたいときは `.dev.vars` の `DEV_SEND_EMAIL="true"`
  (リンク先は localhost のままなので、届いたメールからローカルにログインできる)

### データベース

`apps/server/src/db/schema.ts` に全18テーブル。**すべてのリレーションに実 FK と
`onDelete: "cascade"`** を張ってあるので、削除の連鎖をアプリ側で書く必要はない。

日時は `integer({ mode: "timestamp_ms" })`。チャットが createdAt 昇順で並ぶため、
秒精度だと同一秒内で順序が壊れる。

**`class` と `classSlot` を分けている理由:** シラバスの元データは「1行 = 1コマ」で、
週複数コマの授業は同じ no_id のまま複数行に分かれている（最大4コマ）。
`class.id` に no_id を使う以上、コマを正規化しないと主キーが重複し、
時間割にも片方のコマしか出せない。授業検索の曜日/時限フィルタは `classSlot` への EXISTS。

### 公開範囲（直感と逆に見えるが意図的）

非公開ユーザーの投稿は「**投稿者が自分をフォローしている**」ときに見える。
自分が投稿者をフォローしているとき、ではない。

```
follow: followingId = フォローする側 / followedId = される側
条件  : followingId = 投稿者 かつ followedId = 自分
```

非公開ユーザーが「自分がフォローした相手に対して投稿を開示する」というモデル。
**仕様として確認済みなので反転させないこと。** `routes/posts.ts`・`routes/users.ts`・
`routes/classes.ts` の履修者一覧で条件を揃えてある。

**`follow` を JOIN するときは、投稿者を絞る条件を必ず ON 句に入れる。**
WHERE にだけ書くと、複数人をフォローしている公開ユーザーの投稿が
フォロー関係の数だけ重複して出る。

### D1 のクエリ数制限

D1 は1リクエストあたりのクエリ数に制限があるため、**ループ内で await するのは避ける**。
旧実装はタイムラインで投稿ごとに `count()`、未読件数で履修授業ごとに1クエリを発行していた。
新実装ではそれぞれ `GROUP BY` 1本、画像は `inArray` でまとめて引いている。

### 画像 (R2)

- アップロードは `multipart/form-data`。**ここだけ RPC ではなく素の `fetch`**（`src/lib/upload.ts`）
- **DB にはオブジェクトキーだけを保存**し、URL は保存しない。
  表示側は `lib/format.ts` の `imageUrl(key)` を必ず通す（配信方法を変えるときここ1箇所で済む）
- 配信は `GET /api/images/*`。`Cache-Control: immutable` + ETag
- **R2 は変換をしない。** 縮小はアップロード前にクライアントの `browser-image-compression` で行う
- 投稿・アバターの削除時は `deleteImages()` で R2 の実体も消す（FK cascade では消えない）

### フロントの規約

- データ取得は **TanStack Query に一本化**。`src/hooks/` にエンドポイントごとのフックを置く
- mutation 後は `invalidateQueries`。旧実装の `window.dispatchEvent(new CustomEvent('postsRefresh'))`
  のような DOM イベント方式は使わない
- 認証ガードと初回セットアップの誘導は `ProtectedLayout` の1箇所に集約。
  各ページに認証チェックを書かない
- **入力欄の `value` は必ずローカル state から供給する。**
  `useSearchParams` など外部ストアから直接引くと、キー入力ごとに
  ルーターの遷移 -> 再レンダリングが挟まって value の反映が一拍遅れ、
  React が古い値を DOM に書き戻して **IME の変換中の文字列が消える**
  (日本語が入力できなくなる)。URL や API への反映は `useDebounced` で
  後追いにすること。`pages/FindClass.tsx` が実例
- 新しい UI は **shadcn/ui** で作り、色やサイズは CSS 変数トークン
  (`bg-background`, `text-foreground` 等) を使う。`bg-white` のような直値を書かない
- 追加は `apps/web` で `pnpm dlx shadcn@latest add <component>`

### ディレクトリ

```
apps/server/src/
  index.ts        # Hono app の組み立てと AppType の export
  auth.ts         # better-auth (magicLink + drizzleAdapter)
  middleware.ts   # requireAuth
  validator.ts    # zValidator のラッパー（RPC の型を保つ）
  mail.ts         # Cloudflare Email Sending
  storage.ts      # R2
  constants.ts    # web からも "server/constants" で読める共有定数
  db/schema.ts    # 全18テーブル
  routes/         # posts, messages, classes, departments, schedule, users, profile, social, misc
apps/server/scripts/
  seed-classes.ts # t.json -> class/classSlot の SQL 生成
apps/web/src/
  client.ts       # hc<AppType>("/")
  App.tsx         # 全ルート定義
  components/     # AppLayout, ProtectedLayout, PostCard, PostComposer, ui/(shadcn)
  hooks/          # usePosts, useMessages, useClasses, useSocial, useProfile
  pages/          # 13画面
```

## 授業データの投入

```sh
cd apps/server
pnpm exec tsx scripts/seed-classes.ts <t.json のパス>   # drizzle/seed/classes.sql を生成
pnpm exec wrangler d1 execute hoseilink-d1 --local --file drizzle/seed/classes.sql
```

元データ (`t.json`) は旧リポジトリの `scraping/` にある。スクレイピングスクリプト自体は
移植対象外なので旧リポジトリに置いたまま。

## 旧 Neon DB からのデータ復元

旧サービスのユーザー・投稿・DM・履修登録などは `jsons/` に置いた JSON エクスポートから取り込む。

```sh
cd apps/server
pnpm exec tsx scripts/migrate-images.ts            # 旧 Cloudflare Images -> ローカル R2
pnpm exec tsx scripts/migrate-images.ts --remote   # 同 -> 本番 R2
pnpm exec tsx scripts/import-legacy.ts             # drizzle/seed/legacy.sql を生成
pnpm exec wrangler d1 execute hoseilink-d1 --local --file drizzle/seed/legacy.sql
```

**`jsons/` と `legacy.sql` は gitignore してある。** 実在ユーザーのメールアドレス・
パスワードハッシュ・DM 本文が入っているのでコミットしないこと。

注意点:

- 旧ユーザーの **ID をそのまま維持**して取り込んでいる。better-auth の magic link は
  `account` 行を要求せず、メールでユーザーを引いてセッションを張るだけなので、
  `user` テーブルに行があれば旧ユーザーはそのままログインできる
- 旧ダンプの日時は `"2026-04-13 02:35:15.366009"` という **ISO8601 ではない形式**。
  `new Date()` に直接渡すとローカル時刻と解釈され JST 環境では9時間ずれる。
  `import-legacy.ts` の `toEpochMs()` を必ず通すこと
- `migrate-images.ts` は **冪等**。既存の `drizzle/seed/image-keys.json` にキーがあれば
  それを使い回すので、ローカルR2と本番R2で同じキーになる。この対応表を消すと
  採番し直しになり両者がずれる

## 移植していないもの

Web Push 通知 / PWA（旧 `lib/push.ts`, `public/sw.js`, `pushSubscriptionsTable`）と
`scraping/` のスクレイピングスクリプトは、意図的にスコープ外としている。
