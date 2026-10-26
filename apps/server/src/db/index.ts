import { drizzle } from "drizzle-orm/d1";
import type { Bindings } from "../env";

/**
 * Workers では env がリクエストスコープなので、Next.js 版のように
 * モジュールのトップレベルで db インスタンスを作ることはできない。
 * ハンドラごとに c.env から生成する。
 */
export const getDb = (env: Bindings) => drizzle(env.DB);

export type Db = ReturnType<typeof getDb>;
