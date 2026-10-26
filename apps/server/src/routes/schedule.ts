import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import * as v from "valibot";

import { getDb } from "../db";
import { classMessage, classSlot, classes, register, user } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { validator } from "../validator";

/**
 * 履修登録と時間割。
 *
 * 未読件数の集計は旧実装 (app/api/schedule/class-messages-counts/route.ts) では
 * 履修している授業ごとに1クエリ発行する N+1 だった。
 * D1 は1リクエストあたりのクエリ数に制限があるので、GROUP BY 1本にまとめている。
 */
export const scheduleRoute = new Hono<AppEnv>()
  /**
   * 自分の履修一覧。時間割グリッドの描画に使う。
   * 週複数コマの授業は slots が複数返るので、フロントはコマの数だけセルを埋める。
   */
  .get("/registers", requireAuth, async (c) => {
    const me = c.get("user").id;
    const db = getDb(c.env);

    const rows = await db
      .select({
        registerId: register.id,
        lastViewedAt: register.lastViewedAt,
        class: classes,
      })
      .from(register)
      .innerJoin(classes, eq(classes.id, register.classId))
      .where(eq(register.userId, me));

    const slotsByClass = new Map<string, { youbi: string; time: number }[]>();
    if (rows.length > 0) {
      const slots = await db
        .select({
          classId: classSlot.classId,
          youbi: classSlot.youbi,
          time: classSlot.time,
        })
        .from(classSlot)
        .where(inArray(classSlot.classId, rows.map((row) => row.class.id)));

      for (const slot of slots) {
        const list = slotsByClass.get(slot.classId) ?? [];
        list.push({ youbi: slot.youbi, time: slot.time });
        slotsByClass.set(slot.classId, list);
      }
    }

    return c.json({
      registers: rows.map((row) => ({
        ...row,
        class: { ...row.class, slots: slotsByClass.get(row.class.id) ?? [] },
      })),
    });
  })

  .post(
    "/registers",
    requireAuth,
    requireSetup,
    validator("json", v.object({ classId: v.pipe(v.string(), v.minLength(1)) })),
    async (c) => {
      const me = c.get("user").id;
      const { classId } = c.req.valid("json");

      await getDb(c.env)
        .insert(register)
        .values({ classId, userId: me })
        .onConflictDoNothing();

      return c.json({ ok: true, isRegistered: true });
    },
  )

  .delete(
    "/registers",
    requireAuth,
    validator("json", v.object({ classId: v.pipe(v.string(), v.minLength(1)) })),
    async (c) => {
      const me = c.get("user").id;
      const { classId } = c.req.valid("json");

      await getDb(c.env)
        .delete(register)
        .where(and(eq(register.userId, me), eq(register.classId, classId)));

      return c.json({ ok: true, isRegistered: false });
    },
  )

  /**
   * 履修している授業ごとの未読メッセージ件数。
   * lastViewedAt 以降で、かつ自分以外が書いたものを数える。
   */
  .get("/schedule/class-message-counts", requireAuth, async (c) => {
    const me = c.get("user").id;

    const rows = await getDb(c.env)
      .select({
        classId: register.classId,
        count: sql<number>`count(${classMessage.id})`.mapWith(Number),
      })
      .from(register)
      .leftJoin(
        classMessage,
        and(
          eq(classMessage.classId, register.classId),
          ne(classMessage.userId, me),
          // 未閲覧なら全件、閲覧済みならその時刻以降
          or(
            isNull(register.lastViewedAt),
            gt(classMessage.createdAt, register.lastViewedAt),
          ),
        ),
      )
      .where(eq(register.userId, me))
      .groupBy(register.classId);

    return c.json({ classCounts: rows });
  })

  /** 時間割ページ全体の新着件数。ヘッダーのバッジ用 */
  .get("/schedule/new-messages-count", requireAuth, async (c) => {
    const me = c.get("user").id;
    const db = getDb(c.env);

    const [profile] = await db
      .select({ lastScheduleViewAt: user.lastScheduleViewAt })
      .from(user)
      .where(eq(user.id, me))
      .limit(1);

    // 一度も開いていないなら「新着」という概念がないので0扱い (旧実装と同じ)
    if (!profile?.lastScheduleViewAt) {
      return c.json({ count: 0 });
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(classMessage)
      .innerJoin(
        register,
        and(
          eq(register.classId, classMessage.classId),
          eq(register.userId, me),
        ),
      )
      .where(
        and(
          gt(classMessage.createdAt, profile.lastScheduleViewAt),
          ne(classMessage.userId, me),
        ),
      );

    return c.json({ count: row?.count ?? 0 });
  })

  /** その授業のチャットを開いた時刻を記録する */
  .patch("/schedule/class/:classId/view", requireAuth, async (c) => {
    const me = c.get("user").id;
    const classId = c.req.param("classId");

    await getDb(c.env)
      .update(register)
      .set({ lastViewedAt: new Date() })
      .where(and(eq(register.userId, me), eq(register.classId, classId)));

    return c.json({ ok: true });
  })

  /** 時間割ページを開いた時刻を記録する */
  .patch("/user/schedule-view", requireAuth, async (c) => {
    const me = c.get("user").id;

    await getDb(c.env)
      .update(user)
      .set({ lastScheduleViewAt: new Date() })
      .where(eq(user.id, me));

    return c.json({ ok: true });
  });
