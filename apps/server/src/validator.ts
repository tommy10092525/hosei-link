import { vValidator } from "@hono/valibot-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

/**
 * vValidator のラッパー。
 *
 * 素の vValidator はバリデーション失敗時に Valibot の結果オブジェクトを
 * そのまま JSON で返す。すると RPC の戻り値型が
 *   { success: false, issues: ... } | { 実際のレスポンス }
 * というユニオンになり、クライアントで毎回ナローイングが必要になってしまう。
 *
 * ここで HTTPException を投げることで、
 *   - 戻り値型が成功時の形だけになる
 *   - エラー応答が onError の { error: string } 形式に統一される
 * の両方が得られる。
 */
export const validator = <
  T extends v.GenericSchema | v.GenericSchemaAsync,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  vValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: "リクエストの形式が不正です" });
    }
  });

/**
 * 文字列でも数値でも受け取って整数にする (zod の z.coerce.number().int() 相当)。
 * クエリパラメータは常に文字列で届くので、数値系のクエリはこれを通す。
 */
export const int = v.pipe(v.union([v.string(), v.number()]), v.toNumber(), v.integer());
