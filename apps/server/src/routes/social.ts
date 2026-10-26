import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { getDb } from "../db";
import { block, follow, report } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth } from "../middleware";
import { validator } from "../validator";

const targetSchema = v.object({ targetUserId: v.pipe(v.string(), v.minLength(1)) });

/**
 * フォロー / ブロック / 通報。
 *
 * 旧実装ではブロックと通報が page.tsx 内の inline server action として
 * 埋まっていた (app/user/[id]/page.tsx, components/client/actions.ts)。
 * ここで通常の API に揃える。
 */
export const socialRoute = new Hono<AppEnv>()
  /** フォローする。follow.followingId = フォローする側 = 自分 */
  .post("/follow", requireAuth, validator("json", targetSchema), async (c) => {
    const me = c.get("user").id;
    const { targetUserId } = c.req.valid("json");

    if (targetUserId === me) {
      throw new HTTPException(400, { message: "自分自身はフォローできません" });
    }

    // 一意制約があるので、既にフォロー済みなら黙って成功扱いにする
    await getDb(c.env)
      .insert(follow)
      .values({ followedId: targetUserId, followingId: me })
      .onConflictDoNothing();

    return c.json({ ok: true, isFollowing: true });
  })

  .delete("/follow", requireAuth, validator("json", targetSchema), async (c) => {
    const me = c.get("user").id;
    const { targetUserId } = c.req.valid("json");

    await getDb(c.env)
      .delete(follow)
      .where(and(eq(follow.followedId, targetUserId), eq(follow.followingId, me)));

    return c.json({ ok: true, isFollowing: false });
  })

  .post("/block", requireAuth, validator("json", targetSchema), async (c) => {
    const me = c.get("user").id;
    const { targetUserId } = c.req.valid("json");

    if (targetUserId === me) {
      throw new HTTPException(400, { message: "自分自身はブロックできません" });
    }

    const db = getDb(c.env);
    await db
      .insert(block)
      .values({ blocker: me, blocked: targetUserId })
      .onConflictDoNothing();

    // ブロックしたら相互のフォローも解除する
    await db
      .delete(follow)
      .where(and(eq(follow.followedId, targetUserId), eq(follow.followingId, me)));
    await db
      .delete(follow)
      .where(and(eq(follow.followedId, me), eq(follow.followingId, targetUserId)));

    return c.json({ ok: true, isBlocked: true });
  })

  .delete("/block", requireAuth, validator("json", targetSchema), async (c) => {
    const me = c.get("user").id;
    const { targetUserId } = c.req.valid("json");

    await getDb(c.env)
      .delete(block)
      .where(and(eq(block.blocker, me), eq(block.blocked, targetUserId)));

    return c.json({ ok: true, isBlocked: false });
  })

  /** 投稿の通報 */
  .post(
    "/reports",
    requireAuth,
    validator(
      "json",
      v.object({
        postId: v.pipe(v.string(), v.minLength(1)),
        text: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const { postId, text } = c.req.valid("json");

      await getDb(c.env).insert(report).values({ postId, userId: me, text });

      return c.json({ ok: true }, 201);
    },
  );
