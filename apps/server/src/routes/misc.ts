import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import { getDb } from "../db";
import { contact } from "../db/schema";
import type { AppEnv } from "../env";
import { requireAuth, requireSetup } from "../middleware";
import { UploadError, putImage } from "../storage";
import { validator } from "../validator";

export const miscRoute = new Hono<AppEnv>()
  /**
   * 投稿に添付する画像のアップロード。
   *
   * 旧実装は base64 のデータURLを JSON で送っていたが、
   * multipart で受けたほうが転送量もメモリも小さい。
   * multipart は RPC の型が付かないので、フロントからは素の fetch で叩く
   * (要件で「ファイル送信は fetch 可」とされている箇所)。
   *
   * ここではキーを返すだけで、DB への紐付けは投稿作成時に行う。
   */
  .post("/uploads", requireAuth, requireSetup, async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: "file が必要です" });
    }

    try {
      const key = await putImage(c.env, file, "posts");
      return c.json({ key });
    } catch (e) {
      if (e instanceof UploadError) {
        throw new HTTPException(400, { message: e.message });
      }
      throw e;
    }
  })

  /** 問い合わせフォーム */
  .post(
    "/contact",
    requireAuth,
    validator(
      "json",
      v.object({
        title: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
        content: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
      }),
    ),
    async (c) => {
      const { title, content } = c.req.valid("json");
      await getDb(c.env).insert(contact).values({ title, content });
      return c.json({ ok: true }, 201);
    },
  );
