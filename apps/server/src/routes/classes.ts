import { and, asc, eq, exists, inArray, like, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { getDb } from "../db";
import {
  block,
  classMessage,
  classReview,
  classSlot,
  classes,
  follow,
  register,
  user,
} from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { int, validator } from "../validator";

const PAGE_SIZE = 50;

/** 授業ページに出す人の最小限のプロフィール */
const selectMember = {
  id: user.id,
  name: user.name,
  department: user.department,
  major: user.major,
  avatarKey: user.avatarKey,
  public: user.public,
};

/** 授業IDごとの開講コマをまとめて引く */
const loadSlots = async (
  db: ReturnType<typeof getDb>,
  classIds: string[],
): Promise<Map<string, { youbi: string; time: number }[]>> => {
  const map = new Map<string, { youbi: string; time: number }[]>();
  if (classIds.length === 0) return map;

  const rows = await db
    .select({ classId: classSlot.classId, youbi: classSlot.youbi, time: classSlot.time })
    .from(classSlot)
    .where(inArray(classSlot.classId, classIds));

  for (const row of rows) {
    const list = map.get(row.classId) ?? [];
    list.push({ youbi: row.youbi, time: row.time });
    map.set(row.classId, list);
  }
  return map;
};

export const classesRoute = new Hono<AppEnv>()
  /**
   * 授業検索。
   *
   * 旧実装はシラバス全件 (5.8MB の JSON) をクライアントバンドルに同梱し、
   * SearchForm.tsx が JS で全件フィルタしていた。ここを SQL に置き換えるのが
   * 今回の作り替えで一番効く変更。
   *
   * SQLite の LIKE は ASCII について大文字小文字を区別しない。
   * 旧実装は Postgres の ilike を使っていたが、日本語検索の挙動は変わらない。
   */
  .get(
    "/",
    requireAuth,
    validator(
      "query",
      v.object({
        title: v.optional(v.string()),
        teacher: v.optional(v.string()),
        gakubu: v.optional(v.string()),
        youbi: v.optional(v.string()),
        time: v.optional(int),
        online: v.optional(v.picklist(["true", "false"])),
        offset: v.optional(v.pipe(int, v.minValue(0)), 0),
      }),
    ),
    async (c) => {
      const q = c.req.valid("query");
      const db = getDb(c.env);
      const conditions = [];

      if (q.title) conditions.push(like(classes.title, `%${q.title}%`));
      if (q.teacher) conditions.push(like(classes.teacher, `%${q.teacher}%`));
      if (q.gakubu) conditions.push(eq(classes.gakubu, q.gakubu));
      if (q.online) conditions.push(eq(classes.online, q.online === "true"));

      // 曜日・時限はコマ (classSlot) 側の条件。週複数コマの授業は
      // どれか1コマが一致すればヒットさせたいので EXISTS で絞る
      const slotFilters = [];
      if (q.youbi) slotFilters.push(eq(classSlot.youbi, q.youbi));
      if (q.time !== undefined) slotFilters.push(eq(classSlot.time, q.time));
      if (slotFilters.length > 0) {
        conditions.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(classSlot)
              .where(and(eq(classSlot.classId, classes.id), ...slotFilters)),
          ),
        );
      }

      const rows = await db
        .select()
        .from(classes)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(classes.title))
        .limit(PAGE_SIZE)
        .offset(q.offset);

      const slots = await loadSlots(db, rows.map((row) => row.id));

      return c.json({
        classes: rows.map((row) => ({ ...row, slots: slots.get(row.id) ?? [] })),
        hasMore: rows.length === PAGE_SIZE,
      });
    },
  )

  /** 授業1件。履修者数とレビューの平均点も返す */
  .get("/:id", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");
    const db = getDb(c.env);

    const [row] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    if (!row) {
      throw new HTTPException(404, { message: "授業が見つかりません" });
    }

    const slots = await loadSlots(db, [id]);

    const [stats] = await db
      .select({
        registerCount: sql<number>`count(distinct ${register.id})`.mapWith(Number),
      })
      .from(register)
      .where(eq(register.classId, id));

    const [mine] = await db
      .select({ id: register.id })
      .from(register)
      .where(and(eq(register.classId, id), eq(register.userId, me)))
      .limit(1);

    return c.json({
      class: { ...row, slots: slots.get(id) ?? [] },
      registerCount: stats?.registerCount ?? 0,
      isRegistered: Boolean(mine),
    });
  })

  /**
   * 履修者一覧。
   * 公開範囲は投稿と同じ (公開アカウント / 自分 / 自分をフォローしている人) に揃える。
   */
  .get("/:id/members", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");

    const rows = await getDb(c.env)
      .select(selectMember)
      .from(register)
      .innerJoin(user, eq(user.id, register.userId))
      .leftJoin(
        follow,
        and(eq(follow.followingId, register.userId), eq(follow.followedId, me)),
      )
      .leftJoin(block, and(eq(block.blocker, me), eq(block.blocked, user.id)))
      .where(
        and(
          eq(register.classId, id),
          or(eq(user.public, true), eq(user.id, me), eq(follow.followedId, me)),
          sql`${block.id} is null`,
        ),
      );

    return c.json({ members: rows });
  })

  /* ---------------- 授業チャット ---------------- */

  .get(
    "/:id/messages",
    requireAuth,
    validator(
      "query",
      v.object({
        limit: v.optional(v.pipe(int, v.minValue(1), v.maxValue(500)), 100),
        since: v.optional(int),
      }),
    ),
    async (c) => {
      const id = c.req.param("id");
      const { limit, since } = c.req.valid("query");

      const conditions = [eq(classMessage.classId, id)];
      if (since !== undefined) {
        conditions.push(sql`${classMessage.createdAt} > ${since}`);
      }

      const rows = await getDb(c.env)
        .select({
          id: classMessage.id,
          userId: classMessage.userId,
          text: classMessage.text,
          createdAt: classMessage.createdAt,
          author: selectMember,
        })
        .from(classMessage)
        .innerJoin(user, eq(user.id, classMessage.userId))
        .where(and(...conditions))
        .orderBy(asc(classMessage.createdAt))
        .limit(limit);

      return c.json({ messages: rows });
    },
  )

  .post(
    "/:id/messages",
    requireAuth,
    requireSetup,
    validator("json", v.object({ text: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)) })),
    async (c) => {
      const me = c.get("user").id;
      const classId = c.req.param("id");
      const { text } = c.req.valid("json");

      const [created] = await getDb(c.env)
        .insert(classMessage)
        .values({ classId, userId: me, text })
        .returning();

      return c.json({ message: created ?? null }, 201);
    },
  )

  .delete("/:id/messages/:messageId", requireAuth, async (c) => {
    const me = c.get("user").id;
    const messageId = c.req.param("messageId");
    const db = getDb(c.env);

    const [target] = await db
      .select({ userId: classMessage.userId })
      .from(classMessage)
      .where(eq(classMessage.id, messageId))
      .limit(1);

    if (!target) {
      throw new HTTPException(404, { message: "メッセージが見つかりません" });
    }
    if (target.userId !== me) {
      throw new HTTPException(403, { message: "自分のメッセージしか削除できません" });
    }

    await db.delete(classMessage).where(eq(classMessage.id, messageId));
    return c.json({ ok: true });
  })

  /* ---------------- 授業レビュー ---------------- */

  .get("/:id/reviews", requireAuth, async (c) => {
    const id = c.req.param("id");

    const rows = await getDb(c.env)
      .select({
        id: classReview.id,
        userId: classReview.userId,
        text: classReview.text,
        rating: classReview.rating,
        createdAt: classReview.createdAt,
        author: selectMember,
      })
      .from(classReview)
      .innerJoin(user, eq(user.id, classReview.userId))
      .where(eq(classReview.classId, id))
      .orderBy(asc(classReview.createdAt));

    const average =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length
        : null;

    return c.json({ reviews: rows, average });
  })

  .post(
    "/:id/reviews",
    requireAuth,
    requireSetup,
    validator(
      "json",
      v.object({
        text: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
        rating: v.pipe(int, v.minValue(1), v.maxValue(5)),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const classId = c.req.param("id");
      const { text, rating } = c.req.valid("json");

      // 1人1授業につき1レビュー。一意制約があるので upsert で表現する
      const [created] = await getDb(c.env)
        .insert(classReview)
        .values({ classId, userId: me, text, rating })
        .onConflictDoUpdate({
          target: [classReview.classId, classReview.userId],
          set: { text, rating },
        })
        .returning();

      return c.json({ review: created ?? null }, 201);
    },
  )

  .delete("/:id/reviews/:reviewId", requireAuth, async (c) => {
    const me = c.get("user").id;
    const reviewId = c.req.param("reviewId");
    const db = getDb(c.env);

    const [target] = await db
      .select({ userId: classReview.userId })
      .from(classReview)
      .where(eq(classReview.id, reviewId))
      .limit(1);

    if (!target) {
      throw new HTTPException(404, { message: "レビューが見つかりません" });
    }
    if (target.userId !== me) {
      throw new HTTPException(403, { message: "自分のレビューしか削除できません" });
    }

    await db.delete(classReview).where(eq(classReview.id, reviewId));
    return c.json({ ok: true });
  });
