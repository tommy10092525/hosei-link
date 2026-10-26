import { and, desc, eq, inArray, isNotNull, like, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { getDb } from "../db";
import { block, follow, post, postImage, reaction, user } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth } from "../middleware";
import { validator } from "../validator";

const selectProfile = {
  id: user.id,
  name: user.name,
  department: user.department,
  major: user.major,
  bio: user.bio,
  avatarKey: user.avatarKey,
  public: user.public,
};

export const usersRoute = new Hono<AppEnv>()
  /**
   * ユーザー検索。
   * 公開範囲はタイムラインと同じ (公開アカウント / 自分をフォローしている人)。
   * 旧実装は Postgres の ilike だったが SQLite では like で同等。
   */
  .get(
    "/search",
    requireAuth,
    validator("query", v.object({ q: v.pipe(v.string(), v.trim(), v.minLength(1)) })),
    async (c) => {
      const me = c.get("user").id;
      const { q } = c.req.valid("query");
      const pattern = `%${q}%`;
      const db = getDb(c.env);

      const rows = await db
        .select(selectProfile)
        .from(user)
        .leftJoin(
          follow,
          and(eq(follow.followedId, me), eq(follow.followingId, user.id)),
        )
        .leftJoin(block, and(eq(block.blocker, me), eq(block.blocked, user.id)))
        .where(
          and(
            ne(user.id, me),
            or(
              like(user.name, pattern),
              like(user.department, pattern),
              like(user.major, pattern),
              like(user.bio, pattern),
            ),
            or(eq(user.public, true), isNotNull(follow.id)),
            sql`${block.id} is null`,
          ),
        )
        .limit(30);

      // 自分がフォローしているかを付ける
      const followings = await db
        .select({ followedId: follow.followedId })
        .from(follow)
        .where(eq(follow.followingId, me));
      const followingSet = new Set(followings.map((row) => row.followedId));

      return c.json({
        users: rows.map((row) => ({
          ...row,
          isFollowing: followingSet.has(row.id),
        })),
      });
    },
  )

  /** 自分がフォローしている人 / フォローされている人 */
  .get("/relations", requireAuth, async (c) => {
    const me = c.get("user").id;
    const db = getDb(c.env);

    const [following, followers] = await Promise.all([
      db
        .select(selectProfile)
        .from(follow)
        .innerJoin(user, eq(user.id, follow.followedId))
        .where(eq(follow.followingId, me)),
      db
        .select(selectProfile)
        .from(follow)
        .innerJoin(user, eq(user.id, follow.followingId))
        .where(eq(follow.followedId, me)),
    ]);

    return c.json({ following, followers });
  })

  /** 他人のプロフィールとその投稿 */
  .get("/:id", requireAuth, async (c) => {
    const me = c.get("user").id;
    const id = c.req.param("id");
    const db = getDb(c.env);

    const [profile] = await db
      .select(selectProfile)
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!profile) {
      throw new HTTPException(404, { message: "ユーザーが見つかりません" });
    }

    const [iFollow] = await db
      .select({ id: follow.id })
      .from(follow)
      .where(and(eq(follow.followingId, me), eq(follow.followedId, id)))
      .limit(1);

    // 「相手が自分をフォローしている」= 相手の非公開投稿を見てよい
    const [followsMe] = await db
      .select({ id: follow.id })
      .from(follow)
      .where(and(eq(follow.followingId, id), eq(follow.followedId, me)))
      .limit(1);

    const [blocked] = await db
      .select({ id: block.id })
      .from(block)
      .where(and(eq(block.blocker, me), eq(block.blocked, id)))
      .limit(1);

    const canSeePosts = profile.public || id === me || Boolean(followsMe);

    if (!canSeePosts || blocked) {
      return c.json({
        user: profile,
        isFollowing: Boolean(iFollow),
        isBlocked: Boolean(blocked),
        canSeePosts: false,
        posts: [],
      });
    }

    const myReaction = alias(reaction, "myReaction");
    const allReaction = alias(reaction, "allReaction");

    const rows = await db
      .select({
        id: post.id,
        userId: post.userId,
        content: post.content,
        createdAt: post.createdAt,
        parentPostId: post.parentPostId,
        myReactionId: myReaction.id,
        reactionCount: sql<number>`count(distinct ${allReaction.id})`.mapWith(Number),
      })
      .from(post)
      .leftJoin(myReaction, and(eq(myReaction.postId, post.id), eq(myReaction.userId, me)))
      .leftJoin(allReaction, eq(allReaction.postId, post.id))
      .where(eq(post.userId, id))
      .groupBy(post.id, myReaction.id)
      .orderBy(desc(post.createdAt))
      .limit(50);

    const imagesByPost = new Map<string, string[]>();
    if (rows.length > 0) {
      const images = await db
        .select({ postId: postImage.postId, key: postImage.key })
        .from(postImage)
        .where(inArray(postImage.postId, rows.map((row) => row.id)));

      for (const image of images) {
        const keys = imagesByPost.get(image.postId) ?? [];
        keys.push(image.key);
        imagesByPost.set(image.postId, keys);
      }
    }

    return c.json({
      user: profile,
      isFollowing: Boolean(iFollow),
      isBlocked: false,
      canSeePosts: true,
      posts: rows.map(({ myReactionId, ...row }) => ({
        ...row,
        author: profile,
        isReacted: myReactionId !== null,
        isOwnPost: row.userId === me,
        imageKeys: imagesByPost.get(row.id) ?? [],
      })),
    });
  });
