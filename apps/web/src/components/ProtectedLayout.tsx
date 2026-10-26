import { Navigate, Outlet } from "react-router";

import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/lib/auth-client";

/**
 * ログイン必須の画面をまとめて守る。
 * 旧実装は各 page.tsx で getUserID() を呼んで redirect("/") していたので、
 * 認証チェックが画面の数だけ散らばっていた。
 *
 * 初回セットアップ (名前と学部の入力) はここでは強制しない。
 * 以前は済むまで /setup に足止めしていたが、登録者の7割が中身を一度も見ずに
 * 離脱していたため、閲覧は先にできるようにした。名無しで他のユーザーに
 * 見える操作は、フロントの useSetupGuard とサーバの requireSetup で止める。
 */
export const ProtectedLayout = () => {
  const { data: session, isPending: sessionPending } = useSession();

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

  return <Outlet />;
};
