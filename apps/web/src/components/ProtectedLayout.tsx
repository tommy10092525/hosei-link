import { Navigate, Outlet, useLocation } from "react-router";

import { Spinner } from "@/components/ui/spinner";
import { useProfile } from "@/hooks/useProfile";
import { useSession } from "@/lib/auth-client";

const SETUP_PATH = "/setup";

/**
 * ログイン必須の画面をまとめて守る。
 * 旧実装は各 page.tsx で getUserID() を呼んで redirect("/") していたので、
 * 認証チェックが画面の数だけ散らばっていた。
 *
 * あわせて初回セットアップ (名前と学部の入力) が済むまで /setup に足止めする。
 * magic link で作られた直後のユーザーは name が空なので、そのまま使わせると
 * タイムラインに名無しで現れてしまう。
 */
export const ProtectedLayout = () => {
  const location = useLocation();
  const { data: session, isPending: sessionPending } = useSession();
  // セッションが確定するまでプロフィールは取りに行かない (401 を無駄に踏まないため)
  const { data: profile, isPending: profilePending } = useProfile({
    enabled: Boolean(session),
  });

  if (sessionPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profilePending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  const onSetupPage = location.pathname === SETUP_PATH;

  if (profile?.needsSetup && !onSetupPage) {
    return <Navigate to={SETUP_PATH} replace />;
  }

  return <Outlet />;
};
