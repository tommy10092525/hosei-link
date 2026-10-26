import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * better-auth のクライアント。
 * サーバと同一オリジンなので baseURL は指定不要 (現在のオリジンが使われる)。
 * basePath はサーバ側の betterAuth({ basePath: "/auth" }) と揃える。
 */
export const authClient = createAuthClient({
  basePath: "/auth",
  plugins: [magicLinkClient()],
});

export const { useSession, signOut } = authClient;

/** magic link を送る。ドメイン検証はサーバ側の hooks.before が行う */
export const sendMagicLink = (email: string, callbackURL = "/") =>
  authClient.signIn.magicLink({ email, callbackURL });
