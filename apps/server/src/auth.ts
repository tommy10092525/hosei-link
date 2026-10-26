import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { isAllowedEmail, projectName } from "./constants";
import { getDb } from "./db";
import * as schema from "./db/schema";
import type { Bindings } from "./env";
import { sendMail } from "./mail";

/**
 * better-auth の設定。
 *
 * 旧実装は「登録 → 検証トークン(24h) → verifyEmail() → ログイントークン(5分) →
 * NextAuth Credentials」という4段構えを全部手書きしていた。
 * ここでは magic link プラグインに置き換え、ユーザーテーブルの読み書きは
 * drizzle adapter に任せる。アプリ側に残る実装はドメイン検証とメール本文だけ。
 *
 * Workers では env がリクエストスコープなので、モジュールのトップレベルで
 * インスタンスを作らずリクエストごとに生成する。
 */
export const createAuth = (env: Bindings) =>
  betterAuth({
    database: drizzleAdapter(getDb(env), {
      provider: "sqlite",
      schema,
    }),
    baseURL: env.BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/auth",

    // フロントと API が同一オリジンなので SameSite=Lax のままで通る
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: new URL(env.BASE_URL).protocol === "https:",
        httpOnly: true,
      },
    },

    /**
     * アプリ固有のユーザー属性。
     * 別テーブルに切らず user テーブルに同居させている (db/schema.ts 参照)。
     *
     * すべて input: false にしてある。これらは /api/profile 経由でしか更新させず、
     * サインアップのリクエストボディに混ぜて注入されないようにするため。
     * 特に public は「新規ユーザーは非公開で始まる」ことを保証したいので重要。
     */
    user: {
      additionalFields: {
        department: { type: "string", required: false, input: false },
        major: { type: "string", required: false, input: false },
        public: { type: "boolean", required: false, defaultValue: false, input: false },
        bio: { type: "string", required: false, input: false },
        avatarKey: { type: "string", required: false, input: false },
        lastScheduleViewAt: { type: "date", required: false, input: false },
        weeklyDigest: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },

    /**
     * 大学ドメイン以外のアドレスを弾く。
     * sendMagicLink の中でも弾けるが、そのタイミングでは既に verification 行が
     * 作られてしまうので、エンドポイントに入る前のフックで止める。
     * APIError を投げると 500 ではなく 400 とメッセージがクライアントに返る。
     * (旧 lib/email.ts の emailRegex と app/constants.ts の allowedEmails に相当)
     */
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") return;

        const email = (ctx.body as { email?: string } | undefined)?.email;
        if (!email || !isAllowedEmail(email)) {
          throw new APIError("BAD_REQUEST", {
            message: "法政大学のメールアドレス (@stu.hosei.ac.jp) のみ利用できます",
          });
        }
      }),
    },

    plugins: [
      magicLink({
        expiresIn: 60 * 10, // 10分
        sendMagicLink: async ({ email, url }) => {
          // url は baseURL (= env.BASE_URL) から組み立てられるので、
          // 開発環境では localhost、本番では独自ドメインのリンクになる。
          const isDevelopment = env.APP_ENV !== "production";

          // どちらの環境でも、どのモードでどのURLを出したかを必ず記録する。
          // 「ローカルなのに本番URLのメールが飛ぶ」ような設定ミス
          // (.dev.vars が読まれていない等) をログで即座に気づけるようにするため。
          console.log(
            `[auth] magic link mode=${env.APP_ENV} baseURL=${env.BASE_URL} to=${email}`,
          );

          if (isDevelopment) {
            // 開発中はメールを受け取れないことが多いので、リンクを直接ログに出す
            console.log(`[dev] magic link: ${url}`);

            // 既定では実送信しない。メール到達まで確かめたいときだけ
            // .dev.vars で DEV_SEND_EMAIL="true" にする
            if (env.DEV_SEND_EMAIL !== "true") return;
            console.log("[dev] DEV_SEND_EMAIL=true のため実際に送信します");
          }

          await sendMail(env, {
            to: email,
            subject: `${projectName} へのログイン`,
            text: [
              `次のリンクを開くと ${projectName} にログインできます。`,
              url,
              "",
              "このリンクは10分で失効します。心当たりがない場合は破棄してください。",
            ].join("\n"),
            html: [
              `<p>次のリンクを開くと ${projectName} にログインできます。</p>`,
              `<p><a href="${url}">${url}</a></p>`,
              "<p>このリンクは10分で失効します。心当たりがない場合は破棄してください。</p>",
            ].join(""),
          });
        },
      }),
    ],
  });

export type Auth = ReturnType<typeof createAuth>;
