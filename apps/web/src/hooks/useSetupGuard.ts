import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { useProfile } from "@/hooks/useProfile";

/** /setup に渡す location.state。セットアップ後に元の画面へ戻すのに使う */
export type SetupState = { from?: string };

/**
 * 初回セットアップ (名前と学部) が未完了かどうかと、操作前のガード。
 *
 * 閲覧はセットアップ前でもできるようにしてあり、他のユーザーに自分が見える操作
 * (いいね・フォロー・履修登録など) のときだけ /setup に誘導する。
 * サーバ側も requireSetup で同じ操作を止めている。
 *
 *   const { guard } = useSetupGuard();
 *   onClick={() => guard() && mutate(...)}
 */
export const useSetupGuard = () => {
  const { data } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  const needsSetup = data?.needsSetup ?? false;
  const from = `${location.pathname}${location.search}`;

  const guard = useCallback(() => {
    if (!needsSetup) return true;
    toast("プロフィールを設定すると使えるようになります");
    navigate("/setup", { state: { from } satisfies SetupState });
    return false;
  }, [needsSetup, navigate, from]);

  return { needsSetup, guard, from };
};
