import { Search, Users } from "lucide-react";
import { Link } from "react-router";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState, Notice } from "@/components/Notice";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useTimeline } from "@/hooks/usePosts";

/**
 * タイムライン。旧 app/timeline/page.tsx + components/client/Posts.tsx の置き換え。
 *
 * 旧実装は mutation のたびに CustomEvent を dispatch して Posts.tsx が
 * 自前で state を書き換えていたが、ここは useInfiniteQuery と
 * invalidateQueries に一本化されている。
 */
export const Timeline = () => {
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTimeline();

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <>
      <AppHeader
        actions={
          <Button variant="ghost" size="icon" asChild>
            <Link to="/find">
              <Search />
              <span className="sr-only">授業を探す</span>
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <PostComposer />

        {error && <Notice variant="error">{error.message}</Notice>}

        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Users}
            action={
              <Button variant="outline" asChild>
                <Link to="/friends">友達をさがす</Link>
              </Button>
            }
          >
            まだ投稿がありません。授業を登録したり、友達をフォローしたりすると、ここに投稿が並びます。
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="flex justify-center pb-4">
            <Button
              variant="outline"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? <Spinner className="size-4" /> : "もっと読む"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};
