import { and, eq, gt, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { getDb } from "../db";
import { block, message, user } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { int, validator } from "../validator";

/**
 * DM。
 * 旧実装 (app/api/messages/**) と同じく、GET のたびに相手からの未読を既読にする。
 */
export const messagesRoute = new Hono<AppEnv>()
  /** 未読メッセージの送信者と件数。ヘッダーのバッジに使う */
  .get("/unread", requireAuth, async (c) => {
    const me = c.get("user").id;

    const senders = await getDb(c.env)
      .select({
        senderId: message.fromUserId,
        name: user.name,
        avatarKey: user.avatarKey,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(message)
      .innerJoin(user, eq(user.id, message.fromUserId))
      .where(and(eq(message.toUserId, me), eq(message.isRead, false)))
      .groupBy(message.fromUserId, user.name, user.avatarKey);

    return c.json({
      senders,
      total: senders.reduce((sum, sender) => sum + sender.count, 0),
    });
  })

  /** 特定の相手とのやりとり。取得と同時に相手からの未読を既読化する */
  .get(
    "/",
    requireAuth,
    validator(
      "query",
      v.object({
        peerId: v.pipe(v.string(), v.minLength(1)),
        limit: v.optional(v.pipe(int, v.minValue(1), v.maxValue(500)), 100),
        /** epoch ミリ秒。これより後のメッセージだけ取る (ポーリング用) */
        since: v.optional(int),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const { peerId, limit, since } = c.req.valid("query");
      const db = getDb(c.env);

      const conditions = [
        or(
          and(eq(message.fromUserId, me), eq(message.toUserId, peerId)),
          and(eq(message.fromUserId, peerId), eq(message.toUserId, me)),
        ),
      ];
      if (since !== undefined) {
        conditions.push(gt(message.createdAt, new Date(since)));
      }

      const [rows] = await Promise.all([
        db
          .select({
            id: message.id,
            fromUserId: message.fromUserId,
            toUserId: message.toUserId,
            content: message.content,
            createdAt: message.createdAt,
          })
          .from(message)
          .where(and(...conditions))
          .orderBy(message.createdAt)
          .limit(limit),
        db
          .update(message)
          .set({ isRead: true })
          .where(
            and(
              eq(message.fromUserId, peerId),
              eq(message.toUserId, me),
              eq(message.isRead, false),
            ),
          ),
      ]);

      return c.json({ messages: rows });
    },
  )

  .post(
    "/",
    requireAuth,
    requireSetup,
    validator(
      "json",
      v.object({
        peerId: v.pipe(v.string(), v.minLength(1)),
        content: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const { peerId, content } = c.req.valid("json");
      const db = getDb(c.env);

      // 相手にブロックされていたら送らせない (旧実装にはなかった保護)
      const [blocked] = await db
        .select({ id: block.id })
        .from(block)
        .where(and(eq(block.blocker, peerId), eq(block.blocked, me)))
        .limit(1);

      if (blocked) {
        // ブロックされている事実は伏せ、成功したように見せる
        return c.json({ ok: true, message: null });
      }

      const [created] = await db
        .insert(message)
        .values({ fromUserId: me, toUserId: peerId, content })
        .returning({
          id: message.id,
          fromUserId: message.fromUserId,
          toUserId: message.toUserId,
          content: message.content,
          createdAt: message.createdAt,
        });

      return c.json({ ok: true, message: created ?? null }, 201);
    },
  );
