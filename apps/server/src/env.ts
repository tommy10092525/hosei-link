/**
 * Worker のバインディングと、Hono のコンテキスト変数の型。
 *
 * `Env` は `wrangler types` が worker-configuration.d.ts に生成するグローバル型で、
 * wrangler.jsonc の bindings / vars だけを含む。
 * シークレット (.dev.vars とプロダクションの `wrangler secret put`) は
 * wrangler.jsonc に書かないため生成物には現れないので、ここで明示的に足す。
 *
 * apps/web も AppType 経由でこのファイルを型チェックするので、
 * web の tsconfig の include に ../server/worker-configuration.d.ts を入れてある。
 * どちらの型チェックも `wrangler types` の実行が前提。
 */
/**
 * `wrangler types` は vars をリテラル型で出力する (例: APP_ENV: "production")。
 * そのままだと `env.APP_ENV !== "production"` が「常に false」と推論されてしまうので、
 * 環境で値が変わるものはここで string 系に広げ直す。
 */
export type Bindings = Omit<Env, "APP_ENV" | "BASE_URL" | "MAIL_FROM"> & {
  /**
   * 実行環境。wrangler.jsonc の vars では "production"、
   * ローカルは .dev.vars で "development" に上書きする。
   * BASE_URL から推測せず明示的に持つ (推測は .dev.vars 未読込時に
   * 黙って本番扱いになり、本番URLのメールが飛ぶ事故につながる)。
   */
  APP_ENV: "development" | "production";
  /** magic link のリンク先の組み立てに使う。dev は http://localhost:3000 */
  BASE_URL: string;
  /** magic link の送信元アドレス */
  MAIL_FROM: string;
  /** better-auth のセッション署名鍵 */
  BETTER_AUTH_SECRET: string;
  /**
   * 開発中に実際にメールを送るか。"true" のときだけ送信する。
   * 未設定 (既定) ならログ出力のみで、誤送信も送信枠の消費も起きない。
   * .dev.vars でのみ指定する。
   */
  DEV_SEND_EMAIL?: string;
};

/** requireAuth を通ったハンドラで c.get("user") が返す値 */
export type AuthedUser = {
  id: string;
  email: string;
  name: string;
};

export type Variables = {
  user: AuthedUser;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
