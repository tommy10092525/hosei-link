import {
  Ban,
  ChevronRight,
  Lock,
  LogOut,
  MessageSquare,
  PenLine,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState, Notice } from "@/components/Notice";
import { PostCard } from "@/components/PostCard";
import { UserAvatar } from "@/components/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useToggleBlock, useToggleFollow, useUser } from "@/hooks/useSocial";
import { signOut } from "@/lib/auth-client";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";

const MenuRow = ({
  icon: Icon,
  label,
  to,
  onClick,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}) => {
  const className = cn(
    "hover:bg-accent flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-left font-bold transition-colors",
    danger && "text-danger",
  );
  const content = (
    <>
      <Icon className="size-5" aria-hidden />
      <span className="flex-1">{label}</span>
      {to && <ChevronRight className="text-muted-foreground size-5" aria-hidden />}
    </>
  );

  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
};

/**
 * ユーザーページ。旧 app/user/[id]/page.tsx の置き換え。
 * 自分のページは「マイページ」として、プロフィール編集・問い合わせ・ログアウトの入口を兼ねる。
 */
export const UserProfile = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = useUser(id);
  const { data: me } = useProfile();
  const toggleFollow = useToggleFollow();
  const toggleBlock = useToggleBlock();

  const isMe = me?.profile.id === id;
  const header = isMe ? (
    <AppHeader title="マイページ" />
  ) : (
    <AppHeader title={data ? displayName(data.user.name) : "ユーザー"} back="/timeline" />
  );

  if (isPending) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <Notice variant="error">{error?.message ?? "ユーザーが見つかりません。"}</Notice>
        </div>
      </>
    );
  }

  const { user, isFollowing, isBlocked, canSeePosts, posts } = data;

  return (
    <>
      {header}

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={user.name}
                avatarKey={user.avatarKey}
                className="size-16 *:text-2xl"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl leading-8 font-bold">
                  {displayName(user.name)}
                </h2>
                <p className="text-muted-foreground text-sm leading-[22px]">
                  {user.department}
                  {user.major}
                </p>
                {!user.public && (
                  <Badge variant="tag" className="mt-1">
                    <Lock aria-hidden />
                    非公開アカウント
                  </Badge>
                )}
              </div>
            </div>

            {user.bio && <p className="whitespace-pre-wrap">{user.bio}</p>}

            {!isMe && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  disabled={toggleFollow.isPending}
                  onClick={() =>
                    toggleFollow.mutate(
                      { targetUserId: id, isFollowing },
                      { onError: (e) => toast.error(e.message) },
                    )
                  }
                >
                  {isFollowing ? "フォロー中" : "フォローする"}
                </Button>

                <Button variant="outline" asChild>
                  <Link to={`/chat/${id}`}>
                    <MessageSquare />
                    メッセージ
                  </Link>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-danger ml-auto">
                      <Ban />
                      {isBlocked ? "ブロック解除" : "ブロック"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {isBlocked
                          ? "ブロックを解除しますか？"
                          : "このユーザーをブロックしますか？"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {isBlocked
                          ? "相手の投稿が再びタイムラインに表示されるようになります。"
                          : "相手の投稿が表示されなくなり、相互のフォローも解除されます。"}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        variant={isBlocked ? "default" : "destructive"}
                        onClick={() =>
                          toggleBlock.mutate(
                            { targetUserId: id, isBlocked },
                            { onError: (e) => toast.error(e.message) },
                          )
                        }
                      >
                        {isBlocked ? "解除する" : "ブロックする"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {isMe && (
          <nav
            aria-label="マイページのメニュー"
            className="bg-card divide-y overflow-hidden rounded-lg border shadow-card"
          >
            <MenuRow icon={PenLine} label="プロフィールを編集" to="/profile" />
            <MenuRow icon={Send} label="お問い合わせ" to="/contact" />
            <MenuRow
              icon={LogOut}
              label="ログアウト"
              danger
              onClick={() => void signOut().then(() => navigate("/", { replace: true }))}
            />
          </nav>
        )}

        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm leading-5 font-bold">投稿</h2>
          {!canSeePosts ? (
            <EmptyState icon={Lock}>
              {isBlocked
                ? "ブロックしているユーザーです。"
                : "このアカウントは非公開です。相手からフォローされると投稿が見られるようになります。"}
            </EmptyState>
          ) : posts.length === 0 ? (
            <EmptyState icon={PenLine}>まだ投稿がありません。</EmptyState>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};
