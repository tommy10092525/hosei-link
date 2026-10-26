import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { departmentsStrict } from "../constants";
import { getDb } from "../db";
import { user } from "../db/schema";
import type { AppEnv } from "../env";
import { needsSetup, requireAuth } from "../middleware";
import { UploadError, deleteImages, putImage } from "../storage";
import { validator } from "../validator";

export const profileRoute = new Hono<AppEnv>()
  /** 自分のプロフィール。ヘッダーの表示などに使う */
  .get("/", requireAuth, async (c) => {
    const me = c.get("user").id;

    const [profile] = await getDb(c.env)
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        major: user.major,
        bio: user.bio,
        avatarKey: user.avatarKey,
        public: user.public,
        weeklyDigest: user.weeklyDigest,
      })
      .from(user)
      .where(eq(user.id, me))
      .limit(1);

    if (!profile) {
      throw new HTTPException(404, { message: "プロフィールが見つかりません" });
    }

    // magic link で作られた直後のユーザーは name が空で department も未設定。
    // フロントはこのフラグを見て初回セットアップ画面へ誘導する。
    return c.json({ profile, needsSetup: needsSetup(profile) });
  })

  .patch(
    "/",
    requireAuth,
    validator(
      "json",
      v.object({
        name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
        // 学部は自由入力ではなく既定のリストから選ばせる
        department: v.optional(v.picklist(departmentsStrict)),
        major: v.optional(v.pipe(v.string(), v.maxLength(255))),
        bio: v.optional(v.pipe(v.string(), v.maxLength(1000))),
        public: v.optional(v.boolean()),
        weeklyDigest: v.optional(v.boolean()),
      }),
    ),
    async (c) => {
      const me = c.get("user").id;
      const patch = c.req.valid("json");

      // undefined のキーを渡すと drizzle が「変更なし」ではなく列を消しかねないので落とす
      const values = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(values).length === 0) {
        return c.json({ ok: true });
      }

      await getDb(c.env)
        .update(user)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(user.id, me));

      return c.json({ ok: true });
    },
  )

  /**
   * アバターの差し替え。
   * multipart/form-data で受けるので RPC ではなく素の fetch から呼ぶ。
   */
  .post("/avatar", requireAuth, async (c) => {
    const me = c.get("user").id;
    const db = getDb(c.env);

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file が必要です" });
    }

    let key: string;
    try {
      key = await putImage(c.env, file, "avatars");
    } catch (e) {
      if (e instanceof UploadError) {
        throw new HTTPException(400, { message: e.message });
      }
      throw e;
    }

    const [previous] = await db
      .select({ avatarKey: user.avatarKey })
      .from(user)
      .where(eq(user.id, me))
      .limit(1);

    await db
      .update(user)
      .set({ avatarKey: key, updatedAt: new Date() })
      .where(eq(user.id, me));

    // 差し替え前の画像は参照されなくなるので R2 から消す
    if (previous?.avatarKey) {
      await deleteImages(c.env, [previous.avatarKey]);
    }

    return c.json({ avatarKey: key });
  });
