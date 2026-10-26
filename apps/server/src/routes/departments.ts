import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { departmentsStrict } from "../constants";
import { getDb } from "../db";
import { departmentMessage, user } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { int, validator } from "../validator";

const departmentParam = v.object({ department: v.picklist(departmentsStrict) });

/**
 * 学部ひろば。授業チャット (routes/classes.ts) の学部版。
 *
 * 読むのは誰でもできる (セットアップ前の人にも中身を見せるため)。
 * 書けるのは自分の学部のひろばだけ。
 */
export const departmentsRoute = new Hono<AppEnv>()
  .get(
    "/:department/messages",
    requireAuth,
    validator("param", departmentParam),
    validator(
      "query",
      v.object({
        limit: v.optional(v.pipe(int, v.minValue(1), v.maxValue(500)), 100),
      }),
    ),
    async (c) => {
      const { department } = c.req.valid("param");
      const { limit } = c.req.valid("query");

      // 新しい方から limit 件取って、表示用に古い順へ戻す
      const rows = await getDb(c.env)
        .select({
          id: departmentMessage.id,
          userId: departmentMessage.userId,
          text: departmentMessage.text,
          createdAt: departmentMessage.createdAt,
          author: {
            id: user.id,
            name: user.name,
            department: user.department,
            major: user.major,
            avatarKey: user.avatarKey,
          },
        })
        .from(departmentMessage)
        .innerJoin(user, eq(user.id, departmentMessage.userId))
        .where(eq(departmentMessage.department, department))
        .orderBy(desc(departmentMessage.createdAt))
        .limit(limit);

      return c.json({ messages: rows.reverse() });
    },
  )

  /** ひろばの概要。タイムラインの入口カードに出す */
  .get("/:department", requireAuth, validator("param", departmentParam), async (c) => {
    const { department } = c.req.valid("param");
    const db = getDb(c.env);

    const [members] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(user)
      .where(eq(user.department, department));

    const [latest] = await db
      .select({ text: departmentMessage.text, createdAt: departmentMessage.createdAt })
      .from(departmentMessage)
      .where(eq(departmentMessage.department, department))
      .orderBy(desc(departmentMessage.createdAt))
      .limit(1);

    return c.json({
      department,
      memberCount: members?.count ?? 0,
      latest: latest ?? null,
    });
  })

  .post(
    "/:department/messages",
    requireAuth,
    requireSetup,
    validator("param", departmentParam),
    validator("json", v.object({ text: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)) })),
    async (c) => {
      const me = c.get("user").id;
      const { department } = c.req.valid("param");
      const { text } = c.req.valid("json");
      const db = getDb(c.env);

      const [mine] = await db
        .select({ department: user.department })
        .from(user)
        .where(eq(user.id, me))
        .limit(1);

      if (mine?.department !== department) {
        throw new HTTPException(403, { message: "自分の学部のひろばにだけ書き込めます" });
      }

      const [created] = await db
        .insert(departmentMessage)
        .values({ department, userId: me, text })
        .returning();

      return c.json({ message: created ?? null }, 201);
    },
  )

  .delete("/:department/messages/:messageId", requireAuth, async (c) => {
    const me = c.get("user").id;
    const messageId = c.req.param("messageId");
    const db = getDb(c.env);

    const [target] = await db
      .select({ userId: departmentMessage.userId })
      .from(departmentMessage)
      .where(eq(departmentMessage.id, messageId))
      .limit(1);

    if (!target) {
      throw new HTTPException(404, { message: "メッセージが見つかりません" });
    }
    if (target.userId !== me) {
      throw new HTTPException(403, { message: "自分のメッセージしか削除できません" });
    }

    await db
      .delete(departmentMessage)
      .where(and(eq(departmentMessage.id, messageId), eq(departmentMessage.userId, me)));
    return c.json({ ok: true });
  });
