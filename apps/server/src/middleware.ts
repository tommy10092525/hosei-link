import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { createAuth } from "./auth";
import type { AppEnv } from "./env";

/**
 * ログイン必須のルートに掛ける。
 *
 * 旧実装は21個の route ハンドラそれぞれの冒頭で
 *   const userId = await getUserID(); if (!userId) return 401
 * を書いていた。それをここ1箇所に集約する。
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    throw new HTTPException(401, { message: "ログインしてください" });
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  await next();
});
