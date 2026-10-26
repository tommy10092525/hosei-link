import { BookOpen, Home, User, Users } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";

import { useNewMessagesCount } from "@/hooks/useClasses";
import { useUnreadMessages } from "@/hooks/useMessages";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: typeof Home;
  /** このタブを選択中として扱うパス (それ自身とその配下) */
  match: string[];
  badge?: number;
};

/** 入力欄が画面下に固定される画面ではタブバーを出さない */
const isThreadPath = (pathname: string) =>
  /^\/chat\/[^/]+$/.test(pathname) || /^\/class\/[^/]+\/chat$/.test(pathname);

/**
 * ログイン後の共通レイアウト。下部のタブバー (ホーム・授業・交流・マイページ) を持つ。
 * 上部のバーは画面名が動的に決まるので、各ページが AppHeader を置く。
 *
 * 未読バッジは旧実装ではサーバコンポーネントで描画していたため、
 * ページ遷移するまで更新されなかった。ここでは TanStack Query の
 * refetchInterval で自動的に追従する。
 */
export const AppLayout = () => {
  const { pathname } = useLocation();
  const { data } = useProfile();
  const { data: unread } = useUnreadMessages();
  const { data: newClassMessages } = useNewMessagesCount();

  const myPage = data ? `/user/${data.profile.id}` : "/profile";

  const tabs: Tab[] = [
    { to: "/timeline", label: "ホーム", icon: Home, match: ["/timeline", "/post"] },
    {
      to: "/schedule",
      label: "授業",
      icon: BookOpen,
      match: ["/schedule", "/find", "/class"],
      badge: newClassMessages?.count,
    },
    {
      to: "/chat",
      label: "交流",
      icon: Users,
      match: ["/chat", "/friends", "/user"],
      badge: unread?.total,
    },
    { to: myPage, label: "マイページ", icon: User, match: [myPage, "/profile", "/contact"] },
  ];

  // 自分のユーザーページは /user で始まるので、マイページを先に判定する
  const activeTab =
    [...tabs]
      .reverse()
      .find((tab) =>
        tab.match.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
      ) ?? tabs[0];

  const showTabBar = !isThreadPath(pathname);

  return (
    <div className={cn("bg-muted min-h-dvh", showTabBar && "pb-24")}>
      <Outlet />

      {showTabBar && (
        <nav
          aria-label="メイン"
          className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-2 pb-3">
            {tabs.map((tab) => {
              const current = tab === activeTab;
              return (
                <li key={tab.label}>
                  <Link
                    to={tab.to}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs leading-4 font-bold",
                      current ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid h-7 w-12 place-items-center rounded-full transition-colors duration-150",
                        current && "bg-primary text-primary-foreground",
                      )}
                    >
                      <tab.icon className="size-5" aria-hidden />
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="bg-ink text-surface absolute -top-1 right-0 min-w-5 rounded-full px-1 text-center text-[11px] leading-5">
                          {tab.badge > 99 ? "99+" : tab.badge}
                          <span className="sr-only">件の新着</span>
                        </span>
                      )}
                    </span>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
};
