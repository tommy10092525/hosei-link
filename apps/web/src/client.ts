import { hc } from "hono/client";
import type { AppType } from "server";

/**
 * Hono RPC クライアント。
 *
 * 本番では Worker が SPA と API の両方を配信し、dev では vite の proxy が
 * /api と /auth を wrangler dev に転送するので、どちらでも相対パスでよい。
 * (別オリジン構成をやめたので VITE_API_URL は不要になった)
 *
 * AppType は apps/server の TS ソースから直接型を引いている。
 * サーバ側でルートを足せばここの補完に自動で反映される。
 */
export const client = hc<AppType>("/", {
  init: { credentials: "include" },
});
