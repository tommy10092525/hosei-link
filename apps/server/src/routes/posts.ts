import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { getDb } from "../db";
import { block, follow, post, postImage, reaction, user } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { int, validator } from "../validator";
import { deleteImages } from "../storage";

const PAGE_SIZE = 20;

/** 一覧で返す投稿1件の形。フロントはこの形に対して型が付く */
const selectAuthor = {
  id: user.id,
  name: user.name,
  department: user.department,
  major: user.major,
  avatarKey: user.avatarKey,
  public: user.public,
};

/**
 * 投稿につく画像をまとめて引く。
 * 旧実装は投稿ごとに /api/posts/:id/images を叩いていて N+1 になっていたので、
 * 一覧のレスポンスに最初から含める。
 */
const attachImages = async (
  db: ReturnType<typeof getDb>,
  postIds: string[],
): Promise<Map<string, string[]>> => {
  const map = new Map<string, string[]>();
  if (postIds.length === 0) return map;

  const rows = await db
    .select({ postId: postImage.postId, key: postImage.key })
    .from(postImage)
    .where(inArray(postImage.postId, postIds));

  for (const row of rows) {
    const keys = map.get(row.postId) ?? [];
    keys.push(row.key);
    map.set(row.postId, keys);
  }
  return map;
};

export const postsRoute = new Hono<AppEnv>()
  /**
   * タイムライン。
   *
   * 公開範囲:
   *   投稿者が公開アカウント / 自分の投稿 / 投稿者が自分をフォローしている
   * かつ、自分がブロックしたユーザーの投稿は除外する。
   *
   * ※3つ目の条件は「自分がフォローしている人」ではなく
   *   「自分をフォローしてくれている人」で正しい (仕様として確認済み)。
   *   非公開ユーザーは、自分がフォローした相手に対して投稿を開示する、という
   *   モデルになっている。直感と逆に見えるが意図的なので反転させないこと。
   *   users の検索 (routes/users.ts) も同じ条件で揃えている。
   */
  .get(
    "/",
    requireAuth,
    validator(
      "query",
      v.object({
        offset: v.optional(v.pipe(int, v.minValue(0)), 0),
        /** この時刻より前の投稿を返す。無限スクロール中に新着でずれるのを防ぐ */
        since: v.optional(int),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const { offset, since } = c.req.valid("query");
      const db = getDb(c.env);

      // 「自分のリアクション」と「全リアクション数」で同じテーブルを2回使うので別名にする
      const myReaction = alias(reaction, "myReaction");
      const allReaction = alias(reaction, "allReaction");

      const conditions = [
        or(
          eq(user.public, true),
          eq(post.userId, me),
          // 投稿者が自分をフォローしている (上のコメント参照。意図的)
          eq(follow.followedId, me),
        ),
        isNull(block.id),
      ];
      if (since !== undefined) {
        conditions.push(lt(post.createdAt, new Date(since)));
      }

      const rows = await db
        .select({
          id: post.id,
          userId: post.userId,
          content: post.content,
          createdAt: post.createdAt,
          parentPostId: post.parentPostId,
          author: selectAuthor,
          myReactionId: myReaction.id,
          reactionCount: sql<number>`count(distinct ${allReaction.id})`.mapWith(Number),
        })
        .from(post)
        .innerJoin(user, eq(user.id, post.userId))
        .leftJoin(
          myReaction,
          and(eq(myReaction.postId, post.id), eq(myReaction.userId, me)),
        )
        .leftJoin(allReaction, eq(allReaction.postId, post.id))
        // CLAUDE.md の caveat: 投稿者を絞る条件を ON 句に入れないと、
        // 複数人をフォローしている公開ユーザーの投稿が重複して出る
        .leftJoin(
          follow,
          and(eq(follow.followingId, post.userId), eq(follow.followedId, me)),
        )
        .leftJoin(block, and(eq(block.blocker, me), eq(block.blocked, user.id)))
        .where(and(...conditions))
        .groupBy(post.id, user.id, myReaction.id)
        .orderBy(desc(post.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset);

      const images = await attachImages(
        db,
        rows.map((row) => row.id),
      );

      return c.json({
        posts: rows.map(({ myReactionId, ...row }) => ({
          ...row,
          isReacted: myReactionId !== null,
          isOwnPost: row.userId === me,
          imageKeys: images.get(row.id) ?? [],
        })),
        hasMore: rows.length === PAGE_SIZE,
      });
    },
  )

  /** 投稿する。画像は先に /api/uploads へ送ってキーを受け取っておく */
  .post(
    "/",
    requireAuth,
    requireSetup,
    validator(
      "json",
      v.object({
        content: v.pipe(v.string(), v.maxLength(1000)),
        imageKeys: v.optional(v.pipe(v.array(v.string()), v.maxLength(4)), []),
        /** 返信先。トップレベル投稿なら省略 */
        parentPostId: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const { content, imageKeys, parentPostId } = c.req.valid("json");
      const db = getDb(c.env);

      if (content.trim() === "" && imageKeys.length === 0) {
        throw new HTTPException(400, { message: "本文か画像のどちらかが必要です" });
      }

      const [created] = await db
        .insert(post)
        .values({ userId: me, content, parentPostId: parentPostId ?? null })
        .returning();

      if (!created) {
        throw new HTTPException(500, { message: "投稿の作成に失敗しました" });
      }

      if (imageKeys.length > 0) {
        await db
          .insert(postImage)
          .values(imageKeys.map((key) => ({ postId: created.id, key })));
      }

      return c.json({ post: created }, 201);
    },
  )

  /** 投稿1件。返信スレッドの表示に使う */
  .get("/:id", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");
    const db = getDb(c.env);

    const myReaction = alias(reaction, "myReaction");
    const allReaction = alias(reaction, "allReaction");

    const [row] = await db
      .select({
        id: post.id,
        userId: post.userId,
        content: post.content,
        createdAt: post.createdAt,
        parentPostId: post.parentPostId,
        author: selectAuthor,
        myReactionId: myReaction.id,
        reactionCount: sql<number>`count(distinct ${allReaction.id})`.mapWith(Number),
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.userId))
      .leftJoin(myReaction, and(eq(myReaction.postId, post.id), eq(myReaction.userId, me)))
      .leftJoin(allReaction, eq(allReaction.postId, post.id))
      .where(eq(post.id, id))
      .groupBy(post.id, user.id, myReaction.id)
      .limit(1);

    if (!row) {
      throw new HTTPException(404, { message: "投稿が見つかりません" });
    }

    const images = await attachImages(db, [row.id]);
    const { myReactionId, ...rest } = row;

    return c.json({
      post: {
        ...rest,
        isReacted: myReactionId !== null,
        isOwnPost: row.userId === me,
        imageKeys: images.get(row.id) ?? [],
      },
    });
  })

  /** ある投稿への返信一覧 */
  .get("/:id/replies", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");
    const db = getDb(c.env);

    const myReaction = alias(reaction, "myReaction");
    const allReaction = alias(reaction, "allReaction");

    const rows = await db
      .select({
        id: post.id,
        userId: post.userId,
        content: post.content,
        createdAt: post.createdAt,
        parentPostId: post.parentPostId,
        author: selectAuthor,
        myReactionId: myReaction.id,
        reactionCount: sql<number>`count(distinct ${allReaction.id})`.mapWith(Number),
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.userId))
      .leftJoin(myReaction, and(eq(myReaction.postId, post.id), eq(myReaction.userId, me)))
      .leftJoin(allReaction, eq(allReaction.postId, post.id))
      .leftJoin(block, and(eq(block.blocker, me), eq(block.blocked, user.id)))
      .where(and(eq(post.parentPostId, id), isNull(block.id)))
      .groupBy(post.id, user.id, myReaction.id)
      .orderBy(post.createdAt);

    const images = await attachImages(
      db,
      rows.map((row) => row.id),
    );

    return c.json({
      replies: rows.map(({ myReactionId, ...row }) => ({
        ...row,
        isReacted: myReactionId !== null,
        isOwnPost: row.userId === me,
        imageKeys: images.get(row.id) ?? [],
      })),
    });
  })

  /** 自分の投稿を削除する。返信と画像レコードは FK の cascade で消える */
  .delete("/:id", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");
    const db = getDb(c.env);

    const [target] = await db
      .select({ userId: post.userId })
      .from(post)
      .where(eq(post.id, id))
      .limit(1);

    if (!target) {
      throw new HTTPException(404, { message: "投稿が見つかりません" });
    }
    if (target.userId !== me) {
      throw new HTTPException(403, { message: "自分の投稿しか削除できません" });
    }

    // R2 の実体は cascade では消えないので、行を消す前にキーを控える
    const images = await db
      .select({ key: postImage.key })
      .from(postImage)
      .where(eq(postImage.postId, id));

    await db.delete(post).where(eq(post.id, id));
    await deleteImages(
      c.env,
      images.map((image) => image.key),
    );

    return c.json({ ok: true });
  })

  /**
   * いいねのトグル。
   * 一意制約 (reactionPostUserUniq) があるので二重押しでも壊れない。
   */
  .post(
    "/:id/reaction",
    requireAuth,
    requireSetup,
    async (c) => {
      const me = c.get("user").id;
      const postId = c.req.param("id");
      const db = getDb(c.env);

      const [existing] = await db
        .select({ id: reaction.id })
        .from(reaction)
        .where(and(eq(reaction.postId, postId), eq(reaction.userId, me)))
        .limit(1);

      if (existing) {
        await db.delete(reaction).where(eq(reaction.id, existing.id));
      } else {
        await db.insert(reaction).values({ postId, userId: me, type: "like" });
      }

      const [counted] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(reaction)
        .where(eq(reaction.postId, postId));

      return c.json({
        isReacted: !existing,
        reactionCount: counted?.count ?? 0,
      });
    },
  );
