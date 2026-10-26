import { CornerUpLeft } from "lucide-react";
import { Link, useParams } from "react-router";

import { AppHeader } from "@/components/AppHeader";
import { Notice } from "@/components/Notice";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePost, usePostReplies } from "@/hooks/usePosts";

/** 投稿とその返信スレッド。旧 app/post/[id]/page.tsx の置き換え */
export const PostDetail = () => {
  const { id = "" } = useParams();
  const { data, isPending, error } = usePost(id);
  const replies = usePostReplies(id);

  const replyCount = replies.data?.replies.length ?? 0;

  return (
    <>
      <AppHeader title="投稿" back="/timeline" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {error && <Notice variant="error">{error.message}</Notice>}

        {isPending ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : data ? (
          <>
            {/* 親投稿がある返信なら元の投稿へ辿れるようにする */}
            {data.post.parentPostId && (
              <Button variant="link" size="sm" className="-ml-3" asChild>
                <Link to={`/post/${data.post.parentPostId}`}>
                  <CornerUpLeft className="size-4" />
                  返信元の投稿を見る
                </Link>
              </Button>
            )}

            <PostCard post={data.post} detailed />

            <PostComposer parentPostId={id} placeholder="この投稿に返信する" />

            {replyCount > 0 && (
              <section className="space-y-3">
                <h2 className="text-muted-foreground text-sm leading-5 font-bold">
                  返信 {replyCount}件
                </h2>
                <ul className="space-y-3">
                  {replies.data?.replies.map((reply) => (
                    <li key={reply.id}>
                      <PostCard post={reply} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>
    </>
  );
};
