import { Flag, Heart, MessageCircle, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ReportDialog } from "@/components/ReportDialog";
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
import { Button } from "@/components/ui/button";
import { useDeletePost, useToggleReaction } from "@/hooks/usePosts";
import { useSetupGuard } from "@/hooks/useSetupGuard";
import { displayName, imageUrl, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 投稿1件の表示。
 * タイムライン / 投稿詳細 / ユーザーページで共通に使う。
 * 旧実装では components/client/Post.tsx と各ページに描画が散っていた。
 *
 * 匿名投稿は提供しないので、投稿者のニックネームとアバターは必ず出す。
 * 通報 (自分の投稿なら削除) はメニューに隠さず、操作行の末尾に文言付きで置く。
 */
export type PostCardData = {
  id: string;
  userId: string;
  content: string | null;
  createdAt: string;
  parentPostId: string | null;
  author: {
    id: string;
    name: string;
    department: string | null;
    major: string | null;
    avatarKey: string | null;
    public: boolean;
  };
  reactionCount: number;
  isReacted: boolean;
  isOwnPost: boolean;
  imageKeys: string[];
};

type Props = {
  post: PostCardData;
  /** 投稿詳細ページでは本文を大きく出し、リンクにしない */
  detailed?: boolean;
};

export const PostCard = ({ post, detailed = false }: Props) => {
  const toggleReaction = useToggleReaction();
  const { guard } = useSetupGuard();
  const deletePost = useDeletePost();

  const affiliation = `${post.author.department ?? ""}${post.author.major ?? ""}`;

  return (
    <article className="bg-card rounded-lg border p-4 shadow-card">
      <div className="mb-2 flex items-center gap-3">
        <Link to={`/user/${post.author.id}`} tabIndex={-1} aria-hidden>
          <UserAvatar name={post.author.name} avatarKey={post.author.avatarKey} />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/user/${post.author.id}`}
            className="block truncate text-sm leading-5 font-bold hover:underline"
          >
            {displayName(post.author.name)}
          </Link>
          <p className="text-muted-foreground truncate text-sm leading-[22px]">
            {affiliation && `${affiliation} ・ `}
            {timeAgo(post.createdAt)}
          </p>
        </div>
      </div>

      {post.content && (
        <p
          className={cn(
            "break-words whitespace-pre-wrap",
            detailed && "text-lg leading-[30px]",
          )}
        >
          {post.content}
        </p>
      )}

      {post.imageKeys.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-2",
            post.imageKeys.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {post.imageKeys.map((key) => (
            <img
              key={key}
              src={imageUrl(key)}
              alt=""
              loading="lazy"
              className="max-h-80 w-full rounded-sm object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={post.isReacted}
          className={cn("px-3", post.isReacted ? "text-brand-strong" : "text-muted-foreground")}
          onClick={() =>
            guard() &&
            toggleReaction.mutate(post.id, {
              onError: (e) => toast.error(e.message),
            })
          }
        >
          <Heart className={cn("size-5", post.isReacted && "fill-current")} />
          いいね
          {post.reactionCount > 0 && <span>{post.reactionCount}</span>}
        </Button>

        {!detailed && (
          <Button variant="ghost" size="sm" className="text-muted-foreground px-3" asChild>
            <Link to={`/post/${post.id}`}>
              <MessageCircle className="size-5" />
              返信
            </Link>
          </Button>
        )}

        {post.isOwnPost ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-danger ml-auto px-3">
                <Trash2 className="size-5" />
                削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>この投稿を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  返信と画像もあわせて削除されます。元に戻せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    deletePost.mutate(post.id, {
                      onSuccess: () => toast.success("投稿を削除しました"),
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  削除する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <ReportDialog postId={post.id}>
            <Button variant="ghost" size="sm" className="text-danger ml-auto px-3">
              <Flag className="size-5" />
              通報
            </Button>
          </ReportDialog>
        )}
      </div>
    </article>
  );
};
