import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { createAuth } from "./auth";
import type { AppEnv } from "./env";
import { requireAuth } from "./middleware";
import { classesRoute } from "./routes/classes";
import { messagesRoute } from "./routes/messages";
import { miscRoute } from "./routes/misc";
import { postsRoute } from "./routes/posts";
import { profileRoute } from "./routes/profile";
import { scheduleRoute } from "./routes/schedule";
import { socialRoute } from "./routes/social";
import { usersRoute } from "./routes/users";
import { serveImage } from "./storage";

/**
 * Worker のエントリ。
 *
 * この Worker は API と SPA の両方を担当する。wrangler.jsonc の assets
 * バインディングが apps/web/dist を配信し、run_worker_first で /api/* と
 * /auth/* だけがここに来る。フロントと同一オリジンなので CORS は不要。
 *
 * 重要: Hono RPC の型推論はメソッドチェーンに依存する。
 * ルートを `const app = new Hono(); app.get(...)` のように分けて書くと
 * AppType から型が落ちてクライアントの補完が効かなくなるので、
 * 必ず単一のチェーンで組み立てること。
 */
const app = new Hono<AppEnv>()
  // better-auth のハンドラ (サインイン、magic link の検証、セッション、サインアウト)
  .on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw))

  /** R2 に置いた画像の配信。キーは posts/xxx.jpg のようにスラッシュを含む */
  .get("/api/images/:key{.+}", async (c) => serveImage(c.env, c.req.param("key")))

  /** ログイン中のユーザー。未ログインなら 401 を返すのでフロントの認証ガードに使える */
  .get("/api/me", requireAuth, (c) => c.json({ user: c.get("user") }))

  .route("/api/posts", postsRoute)
  .route("/api/messages", messagesRoute)
  .route("/api/classes", classesRoute)
  .route("/api/users", usersRoute)
  .route("/api/profile", profileRoute)
  // social / schedule / misc は /api 直下に複数のパスを生やす
  .route("/api", socialRoute)
  .route("/api", scheduleRoute)
  .route("/api", miscRoute);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
});

export type AppType = typeof app;

export default app;
