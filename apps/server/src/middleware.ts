import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { createAuth } from "./auth";
import { getDb } from "./db";
import { user } from "./db/schema";
import type { AppEnv } from "./env";

/**
 * 初回セットアップ (名前と学部) が未完了か。
 * magic link で作られた直後のユーザーは name が空で department も未設定。
 */
export const needsSetup = (profile: { name: string; department: string | null }) =>
  profile.name.trim() === "" || profile.department === null;

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

/**
 * 他のユーザーに自分が見える操作 (投稿・チャット・フォロー・履修登録など) に掛ける。
 * requireAuth の後に置くこと。
 *
 * 閲覧はセットアップ前でもできるようにしてあるので (中身を見ずに離脱されるのを防ぐため)、
 * 名無しのユーザーがタイムラインや履修者一覧に現れないよう、書き込みだけここで止める。
 * セッションの user はキャッシュされうるので、セットアップ直後でも通るよう DB を見る。
 */
export const requireSetup = createMiddleware<AppEnv>(async (c, next) => {
  const [profile] = await getDb(c.env)
    .select({ name: user.name, department: user.department })
    .from(user)
    .where(eq(user.id, c.get("user").id))
    .limit(1);

  if (!profile || needsSetup(profile)) {
    throw new HTTPException(403, { message: "先にプロフィール (名前と学部) を設定してください" });
  }

  await next();
});
